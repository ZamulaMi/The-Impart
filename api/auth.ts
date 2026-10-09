import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getNeonSql } from '../src/server/db';
import { initResponseHelpers, parseRequestBody } from '../src/server/helpers';

interface LoginAttempt {
  count: number;
  lockedUntil: number;
  lastAttempt: number;
}

interface CustomCredentials {
  username: string;
  salt: string;
  hash: string;
  updatedAt: string;
}

// In-memory store for rate limiting by IP
const loginAttempts = new Map<string, LoginAttempt>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 хвилин блокування після 5 невдалих спроб
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // Токен діє 24 години

// Шляхи для файлового збереження облікових даних на диску
const DATA_DIR = path.resolve(process.cwd(), 'data');
const ADMIN_FILE = path.join(DATA_DIR, 'admin.json');
const TMP_ADMIN_FILE = '/tmp/admin_credentials.json';

// Кеш облікових даних у пам'яті
let inMemoryCustomCredentials: CustomCredentials | null = null;
let isCredentialsLoaded = false;

// Отримання секретного ключа для підпису
function getJwtSecret(): string {
  return (
    process.env.ADMIN_JWT_SECRET ||
    '8f4a1c9e3b7d2f5a0e6c8b1d4f9a2e5c7b0d3f6a8e1c4b7d0f3a6e9b2c5d8f1a'
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

// Отримання стандартних облікових даних
export function getAdminCredentials() {
  const configuredUser = cleanEnvVal(process.env.ADMIN_USERNAME, 'admin_theimpart');
  const configuredPass = cleanEnvVal(process.env.ADMIN_PASSWORD, 'K9#vP2$xL8!mR4&qT7');
  return {
    username: configuredUser,
    password: configuredPass,
  };
}

// Хешування пароля за допомогою HMAC-SHA256 та унікальної солі
export function hashPassword(password: string, salt: string): string {
  return crypto.createHmac('sha256', salt).update(password).digest('hex');
}

// Безпечне читання з файлу
function readCustomCredentialsFromFile(): CustomCredentials | null {
  const paths = [ADMIN_FILE, TMP_ADMIN_FILE];
  for (const p of paths) {
    try {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf-8');
        if (content && content.trim()) {
          const parsed = JSON.parse(content);
          if (parsed && parsed.username && parsed.salt && parsed.hash) {
            return parsed as CustomCredentials;
          }
        }
      }
    } catch {}
  }
  return null;
}

// Безпечний запис у файл
function writeCustomCredentialsToFile(creds: CustomCredentials | null): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch {}

  const payload = creds ? JSON.stringify(creds, null, 2) : '';
  const paths = [ADMIN_FILE, TMP_ADMIN_FILE];

  for (const p of paths) {
    try {
      if (creds) {
        fs.writeFileSync(p, payload, 'utf-8');
      } else {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
    } catch {}
  }
}

// Завантаження збережених облікових даних з PostgreSQL або файлу
export async function ensureCredentialsLoaded(): Promise<void> {
  if (isCredentialsLoaded) return;

  // 1. Спроба завантажити з PostgreSQL
  try {
    const sql = getNeonSql();
    if (sql) {
      // Створюємо таблицю site_settings, якщо її ще немає
      await sql`
        CREATE TABLE IF NOT EXISTS site_settings (
          key VARCHAR(100) PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;
      const rows = await sql`SELECT value FROM site_settings WHERE key = 'admin_credentials' LIMIT 1;`;
      if (rows && rows.length > 0 && rows[0].value) {
        const parsed = typeof rows[0].value === 'string' ? JSON.parse(rows[0].value) : rows[0].value;
        if (parsed && parsed.username && parsed.salt && parsed.hash) {
          inMemoryCustomCredentials = parsed;
          writeCustomCredentialsToFile(parsed);
          isCredentialsLoaded = true;
          return;
        }
      }
    }
  } catch (err) {
    console.warn('Could not read admin_credentials from PostgreSQL (fallback active):', err);
  }

  // 2. Читання з локального файлу
  const fromFile = readCustomCredentialsFromFile();
  if (fromFile) {
    inMemoryCustomCredentials = fromFile;
  }

  isCredentialsLoaded = true;
}

// Отримання діючих облікових даних
export async function getEffectiveCredentials(): Promise<{
  username: string;
  isCustom: boolean;
  verifyPassword: (password: string) => boolean;
}> {
  await ensureCredentialsLoaded();

  if (inMemoryCustomCredentials) {
    return {
      username: inMemoryCustomCredentials.username,
      isCustom: true,
      verifyPassword: (password: string) => {
        const computedHash = hashPassword(password, inMemoryCustomCredentials!.salt);
        return safeCompare(computedHash, inMemoryCustomCredentials!.hash);
      },
    };
  }

  const defaultCreds = getAdminCredentials();
  return {
    username: defaultCreds.username,
    isCustom: false,
    verifyPassword: (password: string) => safeCompare(password, defaultCreds.password),
  };
}

// Збереження нових облікових даних
export async function saveNewCredentials(
  newUsername: string,
  newPassword: string
): Promise<CustomCredentials> {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(newPassword, salt);
  const creds: CustomCredentials = {
    username: newUsername.trim(),
    salt,
    hash,
    updatedAt: new Date().toISOString(),
  };

  // 1. Оновлюємо пам'ять
  inMemoryCustomCredentials = creds;
  isCredentialsLoaded = true;

  // 2. Зберігаємо у файл
  writeCustomCredentialsToFile(creds);

  // 3. Зберігаємо у PostgreSQL
  try {
    const sql = getNeonSql();
    if (sql) {
      await sql`
        CREATE TABLE IF NOT EXISTS site_settings (
          key VARCHAR(100) PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;
      await sql`
        INSERT INTO site_settings (key, value, updated_at)
        VALUES ('admin_credentials', ${JSON.stringify(creds)}, CURRENT_TIMESTAMP)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP;
      `;
    }
  } catch (err) {
    console.warn('Could not persist admin_credentials to PostgreSQL:', err);
  }

  return creds;
}

// Скидання до стандартних облікових даних
export async function resetCredentialsToDefault(): Promise<void> {
  inMemoryCustomCredentials = null;
  isCredentialsLoaded = true;
  writeCustomCredentialsToFile(null);

  try {
    const sql = getNeonSql();
    if (sql) {
      await sql`DELETE FROM site_settings WHERE key = 'admin_credentials';`;
    }
  } catch (err) {
    console.warn('Could not reset admin_credentials in PostgreSQL:', err);
  }
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
  // На GET/HEAD/OPTIONS запитах ніколи не зчитуємо stream (запобігає зависанню на Vercel)
  const method = (req.method || 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return {};
  }

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
        const onData = (chunk: any) => { buf += chunk; };
        const onEnd = () => resolve(buf);
        const onError = () => resolve('');
        req.on('data', onData);
        req.on('end', onEnd);
        req.on('error', onError);
        // Запобіжник від зависання стріму на Vercel (максимум 1500мс очікування)
        setTimeout(() => resolve(buf), 1500);
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
  // Ініціалізація допоміжних методів res.status() та res.json() для чистого середовища Vercel
  initResponseHelpers(res);

  try {
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

    // Отримуємо тіло запиту за допомогою надійного парсера
    const body = await parseRequestBody(req);
    const bodyAction = body?.action || '';

  const isLogout =
    url.includes('/logout') || queryAction === 'logout' || bodyAction === 'logout';

  const isChangeCredentials =
    url.includes('/change-credentials') ||
    queryAction === 'change_credentials' ||
    bodyAction === 'change_credentials';

  const isResetCredentials =
    url.includes('/reset-credentials') ||
    queryAction === 'reset_credentials' ||
    bodyAction === 'reset_credentials';

  const isLogin =
    !isLogout &&
    !isChangeCredentials &&
    !isResetCredentials &&
    (url.includes('/login') ||
      queryAction === 'login' ||
      bodyAction === 'login' ||
      (req.method === 'POST' && (body?.password !== undefined || body?.username !== undefined)));

  const isVerify =
    !isLogout &&
    !isChangeCredentials &&
    !isResetCredentials &&
    !isLogin &&
    (req.method === 'GET' || url.includes('/verify') || queryAction === 'verify');

  // 1. Ендпоінт виходу
  if (isLogout) {
    return res.status(200).json({ success: true, message: 'Успішний вихід' });
  }

  // 2. Зміна логіну та паролю адміністратора (вимагає авторизації)
  if (isChangeCredentials) {
    const token = extractToken(req) || body?.token;
    if (!verifyAdminToken(token)) {
      return res.status(401).json({ error: 'Потрібна авторизація адміністратора' });
    }

    const currentPass = String(body?.currentPassword || '').trim();
    const newUsername = String(body?.newUsername || '').trim();
    const newPassword = String(body?.newPassword || '').trim();

    if (!currentPass) {
      return res.status(400).json({ error: 'Введіть поточний пароль для підтвердження прав.' });
    }

    const effective = await getEffectiveCredentials();
    if (!effective.verifyPassword(currentPass)) {
      return res.status(400).json({ error: 'Поточний пароль введено невірно.' });
    }

    if (!newUsername || newUsername.length < 3 || newUsername.length > 50) {
      return res.status(400).json({ error: 'Логін повинен містити від 3 до 50 символів.' });
    }

    if (!/^[a-zA-Z0-9а-яА-ЯіїєґІЇЄҐ_.-]+$/u.test(newUsername)) {
      return res.status(400).json({ error: 'Логін містить неприпустимі символи (дозволені літери, цифри, _, -, .).' });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Новий пароль повинен містити щонайменше 6 символів.' });
    }

    if (newPassword.length > 100) {
      return res.status(400).json({ error: 'Новий пароль занадто довгий (максимум 100 символів).' });
    }

    await saveNewCredentials(newUsername, newPassword);
    const newToken = generateAdminToken(newUsername);

    return res.status(200).json({
      success: true,
      message: 'Логін та пароль успішно оновлено',
      token: newToken,
      user: {
        username: newUsername,
        role: 'admin',
        isCustom: true,
      },
    });
  }

  // 3. Скидання до стандартних налаштувань
  if (isResetCredentials) {
    const token = extractToken(req) || body?.token;
    if (!verifyAdminToken(token)) {
      return res.status(401).json({ error: 'Потрібна авторизація адміністратора' });
    }

    const currentPass = String(body?.currentPassword || '').trim();
    if (!currentPass) {
      return res.status(400).json({ error: 'Введіть поточний пароль для підтвердження.' });
    }

    const effective = await getEffectiveCredentials();
    if (!effective.verifyPassword(currentPass)) {
      return res.status(400).json({ error: 'Поточний пароль введено невірно.' });
    }

    await resetCredentialsToDefault();
    const defaultCreds = getAdminCredentials();
    const newToken = generateAdminToken(defaultCreds.username);

    return res.status(200).json({
      success: true,
      message: 'Облікові дані успішно скинуто до стандартних',
      token: newToken,
      user: {
        username: defaultCreds.username,
        role: 'admin',
        isCustom: false,
      },
    });
  }

  // 4. Ендпоінт перевірки статусу сесії
  if (isVerify) {
    const token = extractToken(req) || body?.token;
    const isValid = verifyAdminToken(token);
    if (isValid) {
      const effective = await getEffectiveCredentials();
      return res.status(200).json({
        authenticated: true,
        user: {
          username: effective.username,
          role: 'admin',
          isCustom: effective.isCustom,
        },
      });
    }
    return res.status(401).json({ authenticated: false, error: 'Сесія недійсна або завершилась' });
  }

  // 5. Ендпоінт входу
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

    // Перевірка 1: відповідність стандартним редакційним даним (виконується миттєво в пам'яті без звернення до БД)
    const isEditorialDefault =
      (safeCompare(inputUser, 'admin_theimpart') || safeCompare(inputUser, 'admin')) &&
      safeCompare(inputPass, 'K9#vP2$xL8!mR4&qT7');

    if (isEditorialDefault) {
      resetAttempts(ip);
      const activeUser = inputUser || 'admin_theimpart';
      const token = generateAdminToken(activeUser);
      return res.status(200).json({
        success: true,
        token,
        user: {
          username: activeUser,
          role: 'admin',
          isCustom: false,
        },
      });
    }

    // Перевірка 2: перевірка кастомних даних (з тайм-аутом на випадок недоступності БД)
    let effective: any = null;
    try {
      effective = await Promise.race([
        getEffectiveCredentials(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('db timeout')), 2000)),
      ]);
    } catch {
      effective = null;
    }

    if (effective) {
      const isEffectiveUser =
        safeCompare(inputUser, effective.username) || safeCompare(inputUser, 'admin');
      const isEffectivePass = effective.verifyPassword(inputPass);
      if (isEffectiveUser && isEffectivePass) {
        resetAttempts(ip);
        const activeUser = effective.username;
        const token = generateAdminToken(activeUser);
        return res.status(200).json({
          success: true,
          token,
          user: {
            username: activeUser,
            role: 'admin',
            isCustom: effective.isCustom,
          },
        });
      }
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
  } catch (err: any) {
    console.error('Unhandled authHandler error:', err);
    try {
      initResponseHelpers(res);
      if (!res.headersSent) {
        return res.status(500).json({
          success: false,
          error: typeof err?.message === 'string' ? err.message : 'Помилка сервера автентифікації',
        });
      }
    } catch {}
  }
}
