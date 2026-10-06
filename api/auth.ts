import crypto from 'crypto';

interface LoginAttempt {
  count: number;
  lockedUntil: number;
  lastAttempt: number;
}

// In-memory store for rate limiting by IP
const loginAttempts = new Map<string, LoginAttempt>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 хвилин блокування після 5 невдалих спроб
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // Токен діє 24 години

// Отримання секретного ключа для підпису
function getJwtSecret(): string {
  return (
    process.env.ADMIN_JWT_SECRET ||
    'impart_editorial_secret_salt_9f83ac127e90c74f56b2d18e'
  );
}

// Очищення значень з process.env від випадкових лапок при копіюванні у Vercel
function cleanEnvVal(val: string | undefined, defaultVal: string): string {
  if (!val) return defaultVal;
  let trimmed = val.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  return trimmed || defaultVal;
}

// Отримання дозволених облікових даних
export function getAdminCredentials() {
  const configuredUser = cleanEnvVal(process.env.ADMIN_USERNAME, 'theimpart_editor');
  const configuredPass = cleanEnvVal(process.env.ADMIN_PASSWORD, 'Impart#2026!Sec_k9XvL4Q');
  return {
    username: configuredUser,
    password: configuredPass,
  };
}

// Безпечне порівняння рядків з постійним часом (timing attack protection)
function safeCompare(a: string, b: string): boolean {
  try {
    const aBuf = Buffer.from(a, 'utf-8');
    const bBuf = Buffer.from(b, 'utf-8');
    if (aBuf.length !== bBuf.length) {
      // Виконуємо фейкове порівняння, щоб час виконання не залежав від довжини
      crypto.timingSafeEqual(aBuf, aBuf);
      return false;
    }
    return crypto.timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}

// Генерація підписаного токена сесії
export function generateAdminToken(username: string): string {
  const secret = getJwtSecret();
  const payload = {
    u: username,
    iat: Date.now(),
    exp: Date.now() + TOKEN_TTL_MS,
    nonce: crypto.randomBytes(16).toString('hex'),
  };
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadStr)
    .digest('base64url');
  return `${payloadStr}.${signature}`;
}

// Перевірка підписаного токена
export function verifyAdminToken(token: string | null | undefined): boolean {
  if (!token || typeof token !== 'string') return false;
  const parts = token.trim().split('.');
  if (parts.length !== 2) return false;

  const [payloadStr, signature] = parts;
  const secret = getJwtSecret();
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(payloadStr)
    .digest('base64url');

  if (!safeCompare(signature, expectedSig)) {
    return false;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf-8'));
    if (!decoded || typeof decoded !== 'object') return false;
    if (typeof decoded.exp !== 'number' || Date.now() > decoded.exp) {
      return false; // Термін дії вийшов
    }
    return true;
  } catch {
    return false;
  }
}

// Витягування токена з заголовків або тіла
export function extractToken(req: any): string | null {
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const queryToken = req.query?.token;
  if (queryToken && typeof queryToken === 'string') {
    return queryToken.trim();
  }
  return null;
}

// Отримання IP клієнта
function getClientIp(req: any): string {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (forwarded) {
    return Array.isArray(forwarded)
      ? forwarded[0]
      : forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.connection?.remoteAddress || '127.0.0.1';
}

// Перевірка та реєстрація спроб входу (Rate limiting)
function checkRateLimit(ip: string): { allowed: boolean; remainingLockoutSeconds?: number } {
  const now = Date.now();
  const attempt = loginAttempts.get(ip);
  if (attempt && attempt.lockedUntil > now) {
    const remaining = Math.ceil((attempt.lockedUntil - now) / 1000);
    return { allowed: false, remainingLockoutSeconds: remaining };
  }
  return { allowed: true };
}

function recordFailedAttempt(ip: string): { locked: boolean; remainingLockoutSeconds?: number } {
  const now = Date.now();
  const attempt = loginAttempts.get(ip) || { count: 0, lockedUntil: 0, lastAttempt: now };
  attempt.count += 1;
  attempt.lastAttempt = now;

  if (attempt.count >= MAX_ATTEMPTS) {
    attempt.lockedUntil = now + LOCKOUT_MS;
    loginAttempts.set(ip, attempt);
    return { locked: true, remainingLockoutSeconds: Math.ceil(LOCKOUT_MS / 1000) };
  }

  loginAttempts.set(ip, attempt);
  return { locked: false };
}

function resetAttempts(ip: string) {
  loginAttempts.delete(ip);
}

// Допоміжна функція для отримання тіла запиту у Vercel Serverless / Node.js
async function parseBody(req: any): Promise<any> {
  if (req.body) {
    if (typeof req.body === 'string') {
      try {
        return JSON.parse(req.body);
      } catch {
        try {
          const params = new URLSearchParams(req.body);
          const obj: Record<string, any> = {};
          params.forEach((v, k) => {
            obj[k] = v;
          });
          return obj;
        } catch {
          return {};
        }
      }
    }
    if (typeof req.body === 'object') {
      return req.body;
    }
  }

  // Якщо тіло ще не зчитано (stream у деяких середовищах Node / Vercel)
  if (typeof req.on === 'function' && !req.readableEnded && req.readable) {
    try {
      const data = await new Promise<string>((resolve) => {
        let buf = '';
        req.on('data', (chunk: any) => {
          buf += chunk;
        });
        req.on('end', () => resolve(buf));
        req.on('error', () => resolve(''));
      });
      if (!data) return {};
      try {
        return JSON.parse(data);
      } catch {
        try {
          const params = new URLSearchParams(data);
          const obj: Record<string, any> = {};
          params.forEach((v, k) => {
            obj[k] = v;
          });
          return obj;
        } catch {
          return {};
        }
      }
    } catch {
      return {};
    }
  }

  return {};
}

// Ендпоінт входу / перевірки (сумісний як з Express, так і з Vercel Serverless)
export default async function authHandler(req: any, res: any) {
  // Налаштування CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = req.url || '';
  const ip = getClientIp(req);
  const queryAction = req.query?.action || '';

  // Отримуємо тіло запиту
  const body = await parseBody(req);
  const bodyAction = body?.action || '';

  const isLogout =
    url.includes('/logout') || queryAction === 'logout' || bodyAction === 'logout';

  const isLogin =
    !isLogout &&
    (url.includes('/login') ||
      queryAction === 'login' ||
      bodyAction === 'login' ||
      (req.method === 'POST' && (body?.password !== undefined || body?.username !== undefined)));

  const isVerify =
    !isLogout &&
    !isLogin &&
    (req.method === 'GET' || url.includes('/verify') || queryAction === 'verify');

  // 1. Ендпоінт виходу
  if (isLogout) {
    return res.status(200).json({ success: true, message: 'Успішний вихід' });
  }

  // 2. Ендпоінт перевірки статусу сесії
  if (isVerify) {
    const token = extractToken(req) || body?.token;
    const isValid = verifyAdminToken(token);
    if (isValid) {
      const creds = getAdminCredentials();
      return res.status(200).json({
        authenticated: true,
        user: {
          username: creds.username,
          role: 'admin',
        },
      });
    }
    return res.status(401).json({ authenticated: false, error: 'Сесія недійсна або завершилась' });
  }

  // 3. Ендпоінт входу
  if (isLogin) {
    // Перевірка блокування від брутфорсу
    const rateCheck = checkRateLimit(ip);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: `Забагато невдалих спроб входу. Задля безпеки доступ заблоковано на ${rateCheck.remainingLockoutSeconds} сек.`,
        locked: true,
        retryAfter: rateCheck.remainingLockoutSeconds,
      });
    }

    // Невелика затримка проти таймінг-атак
    await new Promise((resolve) => setTimeout(resolve, 200));

    const inputUser = String(body?.username || '').trim();
    const inputPass = String(body?.password || '').trim();

    const creds = getAdminCredentials();

    // Дозволяємо основний логін або резервний псевдонім 'admin'
    const isUserValid =
      safeCompare(inputUser, creds.username) || safeCompare(inputUser, 'admin');
    const isPassValid = safeCompare(inputPass, creds.password);

    if (isUserValid && isPassValid) {
      resetAttempts(ip);
      const token = generateAdminToken(creds.username);
      return res.status(200).json({
        success: true,
        token,
        user: {
          username: creds.username,
          role: 'admin',
        },
      });
    }

    // Реєструємо невдалу спробу
    const failInfo = recordFailedAttempt(ip);
    if (failInfo.locked) {
      return res.status(429).json({
        error: `Невірний логін або пароль. Ви перевищили кількість спроб (5). Доступ заблоковано на 15 хвилин.`,
        locked: true,
        retryAfter: failInfo.remainingLockoutSeconds,
      });
    }

    const currentAttempt = loginAttempts.get(ip)?.count || 1;
    const remainingAttempts = Math.max(0, MAX_ATTEMPTS - currentAttempt);

    return res.status(401).json({
      error: 'Невірний логін або пароль адміністратора.',
      remainingAttempts,
    });
  }

  return res.status(404).json({ error: 'Endpoint not found' });
}
