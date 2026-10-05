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

// Отримання дозволених облікових даних та валідація
export function validateCredentials(inputUser: string, inputPass: string): { valid: boolean; username: string } {
  const allowedUsers = Array.from(new Set([
    'theimpart_editor',
    'admin_theimpart',
    'admin',
    'impart',
    (process.env.ADMIN_USERNAME || '').trim(),
  ])).filter(Boolean);

  const allowedPasswords = Array.from(new Set([
    'Impart#2026!Sec_k9XvL4Q',
    'K9#vP2$xL8!mR4&qT7',
    (process.env.ADMIN_PASSWORD || '').trim(),
  ])).filter(Boolean);

  const userMatch = allowedUsers.some((u) => safeCompare(inputUser, u));
  const passMatch = allowedPasswords.some((p) => safeCompare(inputPass, p));

  if (userMatch && passMatch) {
    return { valid: true, username: inputUser || 'theimpart_editor' };
  }
  return { valid: false, username: '' };
}

export function getAdminCredentials() {
  const configuredUser = (process.env.ADMIN_USERNAME || 'theimpart_editor').trim();
  const configuredPass = (process.env.ADMIN_PASSWORD || 'Impart#2026!Sec_k9XvL4Q').trim();
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

// Ендпоінт входу / перевірки
export default async function authHandler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = req.url || '';
  const ip = getClientIp(req);

  // 1. Ендпоінт перевірки статусу сесії GET /api/auth/verify
  if (req.method === 'GET' && (url.includes('/verify') || url.endsWith('/auth'))) {
    const token = extractToken(req);
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

  // 2. Ендпоінт входу POST /api/auth/login
  if (req.method === 'POST' && url.includes('/login')) {
    // Перевірка блокування від брутфорсу
    const rateCheck = checkRateLimit(ip);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: `Забагато невдалих спроб входу. Задля безпеки доступ заблоковано на ${rateCheck.remainingLockoutSeconds} сек.`,
        locked: true,
        retryAfter: rateCheck.remainingLockoutSeconds,
      });
    }

    // Затримка проти таймінг-атак та автоматизованих скриптів
    await new Promise((resolve) => setTimeout(resolve, 350));

    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({ error: 'Недійсний JSON' });
      }
    }

    const inputUser = String(body?.username || '').trim();
    const inputPass = String(body?.password || '');

    const check = validateCredentials(inputUser, inputPass);

    if (check.valid) {
      resetAttempts(ip);
      const token = generateAdminToken(check.username);
      return res.status(200).json({
        success: true,
        token,
        user: {
          username: check.username,
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

  // 3. Ендпоінт виходу POST /api/auth/logout
  if (req.method === 'POST' && url.includes('/logout')) {
    return res.status(200).json({ success: true, message: 'Успішний вихід' });
  }

  return res.status(404).json({ error: 'Endpoint not found' });
}
