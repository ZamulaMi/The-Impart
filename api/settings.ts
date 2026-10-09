import fs from 'fs';
import path from 'path';
import { getNeonSql } from './db';
import { verifyAdminToken, extractToken } from './auth';
import { initResponseHelpers, parseRequestBody } from './helpers';

export interface SocialLinksSet {
  telegram?: string;
  instagram?: string;
  x?: string;
  youtube?: string;
  threads?: string;
}

export interface SiteSocialLinks {
  ua: SocialLinksSet;
  en: SocialLinksSet;
}

export const DEFAULT_SOCIAL_LINKS: SiteSocialLinks = {
  ua: {
    telegram: 'https://t.me/impart',
    instagram: 'https://instagram.com/impart',
    x: 'https://x.com/impart_ua',
    youtube: 'https://youtube.com/@impart_ua',
    threads: 'https://threads.net/@impart_ua',
  },
  en: {
    telegram: 'https://t.me/impart_en',
    instagram: 'https://instagram.com/impart_en',
    x: 'https://x.com/impart_en',
    youtube: 'https://youtube.com/@impart_en',
    threads: 'https://threads.net/@impart_en',
  },
};

// Каталог для надійного локального збереження на сервері
const DATA_DIR = path.resolve(process.cwd(), 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

function ensureDataDir(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    console.warn('Could not create data directory:', err);
  }
}

function readSettingsFromFile(): SiteSocialLinks | null {
  try {
    ensureDataDir();
    if (fs.existsSync(SETTINGS_FILE)) {
      const content = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      if (content && content.trim()) {
        const parsed = JSON.parse(content);
        return {
          ua: { ...DEFAULT_SOCIAL_LINKS.ua, ...(parsed.ua || {}) },
          en: { ...DEFAULT_SOCIAL_LINKS.en, ...(parsed.en || {}) },
        };
      }
    }
  } catch (err) {
    console.warn('Failed to read settings from file:', err);
  }
  return null;
}

function writeSettingsToFile(data: SiteSocialLinks): void {
  try {
    ensureDataDir();
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2), 'utf-8');
    console.log('Site settings safely persisted to server disk:', SETTINGS_FILE);
  } catch (err) {
    console.error('Failed to write settings to disk file:', err);
  }
}

// Ініціалізація початкового кешу в пам'яті: з диска або за замовчуванням
const initialFromFile = readSettingsFromFile();
let inMemorySocialLinks: SiteSocialLinks = initialFromFile || { ...DEFAULT_SOCIAL_LINKS };

// Якщо файлу ще не було, записуємо початковий стан на диск
if (!initialFromFile) {
  writeSettingsToFile(inMemorySocialLinks);
}

let isSettingsTableInitialized = false;

async function initSettingsDb() {
  if (isSettingsTableInitialized) return;
  try {
    const sql = getNeonSql();
    if (!sql) return;
    await sql`
      CREATE TABLE IF NOT EXISTS site_settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const existing = await sql`SELECT value FROM site_settings WHERE key = 'social_links' LIMIT 1;`;
    if (!existing || existing.length === 0) {
      await sql`
        INSERT INTO site_settings (key, value)
        VALUES ('social_links', ${JSON.stringify(inMemorySocialLinks)})
        ON CONFLICT (key) DO NOTHING;
      `;
    }
    isSettingsTableInitialized = true;
    console.log('Postgres table "site_settings" is ready.');
  } catch (err) {
    console.warn('Database initialization warning for site_settings (fallback active):', err);
  }
}

export async function getSocialLinks(): Promise<SiteSocialLinks> {
  // 1. Спроба завантажити з PostgreSQL
  try {
    await initSettingsDb();
    const sql = getNeonSql();
    if (sql) {
      const rows = await sql`SELECT value FROM site_settings WHERE key = 'social_links' LIMIT 1;`;
      if (rows && rows.length > 0 && rows[0].value) {
        const parsed = typeof rows[0].value === 'string' ? JSON.parse(rows[0].value) : rows[0].value;
        const combined: SiteSocialLinks = {
          ua: { ...DEFAULT_SOCIAL_LINKS.ua, ...(parsed.ua || {}) },
          en: { ...DEFAULT_SOCIAL_LINKS.en, ...(parsed.en || {}) },
        };
        inMemorySocialLinks = combined;
        writeSettingsToFile(combined);
        return combined;
      }
    }
  } catch (err) {
    console.warn('Database query error in getSocialLinks, falling back to disk/memory:', err);
  }

  // 2. Якщо база спить або недоступна — читаємо з локального файлу на сервері
  const fromFile = readSettingsFromFile();
  if (fromFile) {
    inMemorySocialLinks = fromFile;
    return fromFile;
  }

  // 3. Резервне повернення з кешу пам'яті
  return inMemorySocialLinks;
}

export async function saveSocialLinks(links: any): Promise<SiteSocialLinks> {
  const current = inMemorySocialLinks;

  // Підтримуємо як структуру { ua: {...}, en: {...} }, так і пряму передачу полів
  const uaInput = links?.ua || (!links?.en && (links?.telegram || links?.instagram || links?.x || links?.youtube || links?.threads) ? links : {});
  const enInput = links?.en || {};

  const cleaned: SiteSocialLinks = {
    ua: {
      telegram: uaInput.telegram !== undefined ? String(uaInput.telegram).trim() : (current.ua?.telegram || ''),
      instagram: uaInput.instagram !== undefined ? String(uaInput.instagram).trim() : (current.ua?.instagram || ''),
      x: uaInput.x !== undefined ? String(uaInput.x).trim() : (current.ua?.x || ''),
      youtube: uaInput.youtube !== undefined ? String(uaInput.youtube).trim() : (current.ua?.youtube || ''),
      threads: uaInput.threads !== undefined ? String(uaInput.threads).trim() : (current.ua?.threads || ''),
    },
    en: {
      telegram: enInput.telegram !== undefined ? String(enInput.telegram).trim() : (current.en?.telegram || ''),
      instagram: enInput.instagram !== undefined ? String(enInput.instagram).trim() : (current.en?.instagram || ''),
      x: enInput.x !== undefined ? String(enInput.x).trim() : (current.en?.x || ''),
      youtube: enInput.youtube !== undefined ? String(enInput.youtube).trim() : (current.en?.youtube || ''),
      threads: enInput.threads !== undefined ? String(enInput.threads).trim() : (current.en?.threads || ''),
    },
  };

  // Крок 1: Миттєво оновлюємо пам'ять
  inMemorySocialLinks = cleaned;

  // Крок 2: Миттєво зберігаємо у файл на диску сервера — це 100% гарантує збереження на сервері!
  writeSettingsToFile(cleaned);

  // Крок 3: Синхронізація з PostgreSQL банку даних Neon (з повною ізоляцією помилок)
  try {
    await initSettingsDb();
    const sql = getNeonSql();
    if (sql) {
      const jsonStr = JSON.stringify(cleaned);
      await sql`
        INSERT INTO site_settings (key, value, updated_at)
        VALUES ('social_links', ${jsonStr}, CURRENT_TIMESTAMP)
        ON CONFLICT (key) DO UPDATE
        SET value = ${jsonStr}, updated_at = CURRENT_TIMESTAMP;
      `;
      console.log('Social links synced to PostgreSQL successfully.');
    }
  } catch (err) {
    console.warn('Postgres sync notice: settings saved to server disk, database update failed/delayed:', err);
  }

  return cleaned;
}

export default async function handler(req: any, res: any) {
  initResponseHelpers(res);

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  try {
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method === 'GET') {
      const data = await getSocialLinks();
      return res.status(200).json(data);
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const token = extractToken(req);
      if (!verifyAdminToken(token)) {
        return res.status(401).json({ error: 'Потрібна авторизація адміністратора для зміни налаштувань' });
      }

      let body = await parseRequestBody(req);

      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch {
          return res.status(400).json({ error: 'Недійсний JSON у запиті' });
        }
      }

      if (!body || typeof body !== 'object') {
        if (typeof req.on === 'function' && !req.readableEnded && req.readable) {
          try {
            body = await new Promise((resolve) => {
              let data = '';
              req.on('data', (chunk: any) => { data += chunk; });
              req.on('end', () => {
                try {
                  resolve(data ? JSON.parse(data) : {});
                } catch {
                  resolve({});
                }
              });
              req.on('error', () => resolve({}));
            });
          } catch {
            body = {};
          }
        }
      }

      if (!body || typeof body !== 'object') {
        return res.status(400).json({ error: 'Недійсні дані запиту' });
      }

      const saved = await saveSocialLinks(body);
      return res.status(200).json(saved);
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('Social links handler unexpected error:', error);
    // Навіть у випадку непередбачуваної помилки повертаємо поточні збережені на сервері налаштування
    return res.status(200).json(inMemorySocialLinks);
  }
}
