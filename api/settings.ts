import { getNeonSql, initDb } from './articles';

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
    telegram: 'https://t.me',
    instagram: 'https://instagram.com',
    x: 'https://x.com',
    youtube: 'https://youtube.com',
    threads: 'https://threads.net',
  },
  en: {
    telegram: 'https://t.me',
    instagram: 'https://instagram.com',
    x: 'https://x.com',
    youtube: 'https://youtube.com',
    threads: 'https://threads.net',
  },
};

let inMemorySocialLinks: SiteSocialLinks = { ...DEFAULT_SOCIAL_LINKS };
let isSettingsTableInitialized = false;

async function initSettingsDb() {
  if (isSettingsTableInitialized) return;
  await initDb();
  const sql = getNeonSql();

  try {
    // Створюємо таблицю з типами TEXT для максимальної сумісності
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
        VALUES ('social_links', ${JSON.stringify(DEFAULT_SOCIAL_LINKS)})
        ON CONFLICT (key) DO NOTHING;
      `;
    }
    isSettingsTableInitialized = true;
  } catch (err) {
    console.error('Failed to initialize site_settings table in Postgres, will fallback to memory:', err);
  }
}

export async function getSocialLinks(): Promise<SiteSocialLinks> {
  try {
    await initSettingsDb();
    const sql = getNeonSql();
    const rows = await sql`SELECT value FROM site_settings WHERE key = 'social_links' LIMIT 1;`;
    if (rows && rows.length > 0 && rows[0].value) {
      const val = typeof rows[0].value === 'string' ? JSON.parse(rows[0].value) : rows[0].value;
      const combined: SiteSocialLinks = {
        ua: { ...DEFAULT_SOCIAL_LINKS.ua, ...(val.ua || {}) },
        en: { ...DEFAULT_SOCIAL_LINKS.en, ...(val.en || {}) },
      };
      inMemorySocialLinks = combined;
      return combined;
    }
  } catch (err) {
    console.warn('getSocialLinks database query error, using current cache:', err);
  }
  return inMemorySocialLinks;
}

export async function saveSocialLinks(links: Partial<SiteSocialLinks>): Promise<SiteSocialLinks> {
  const cleaned: SiteSocialLinks = {
    ua: {
      telegram: links.ua?.telegram !== undefined ? String(links.ua.telegram).trim() : (inMemorySocialLinks.ua.telegram || ''),
      instagram: links.ua?.instagram !== undefined ? String(links.ua.instagram).trim() : (inMemorySocialLinks.ua.instagram || ''),
      x: links.ua?.x !== undefined ? String(links.ua.x).trim() : (inMemorySocialLinks.ua.x || ''),
      youtube: links.ua?.youtube !== undefined ? String(links.ua.youtube).trim() : (inMemorySocialLinks.ua.youtube || ''),
      threads: links.ua?.threads !== undefined ? String(links.ua.threads).trim() : (inMemorySocialLinks.ua.threads || ''),
    },
    en: {
      telegram: links.en?.telegram !== undefined ? String(links.en.telegram).trim() : (inMemorySocialLinks.en.telegram || ''),
      instagram: links.en?.instagram !== undefined ? String(links.en.instagram).trim() : (inMemorySocialLinks.en.instagram || ''),
      x: links.en?.x !== undefined ? String(links.en.x).trim() : (inMemorySocialLinks.en.x || ''),
      youtube: links.en?.youtube !== undefined ? String(links.en.youtube).trim() : (inMemorySocialLinks.en.youtube || ''),
      threads: links.en?.threads !== undefined ? String(links.en.threads).trim() : (inMemorySocialLinks.en.threads || ''),
    },
  };

  inMemorySocialLinks = cleaned;

  try {
    await initSettingsDb();
    const sql = getNeonSql();
    const jsonStr = JSON.stringify(cleaned);

    await sql`
      INSERT INTO site_settings (key, value, updated_at)
      VALUES ('social_links', ${jsonStr}, CURRENT_TIMESTAMP)
      ON CONFLICT (key) DO UPDATE
      SET value = ${jsonStr}, updated_at = CURRENT_TIMESTAMP;
    `;
  } catch (err) {
    console.error('Failed to save to Postgres site_settings table, saved in-memory:', err);
  }

  return cleaned;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  try {
    if (req.method === 'GET') {
      const data = await getSocialLinks();
      return res.status(200).json(data);
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      let body = req.body;

      // Якщо тіло не було розпарсено
      if (!body && typeof req.on === 'function') {
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
      }

      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch {
          return res.status(400).json({ error: 'Недійсний JSON у запиті' });
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
    console.error('Social links handler error:', error);
    return res.status(500).json({ error: error?.message || 'Server Error' });
  }
}
