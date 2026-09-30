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

let isSettingsTableInitialized = false;

async function initSettingsDb() {
  if (isSettingsTableInitialized) return;
  await initDb();
  const sql = getNeonSql();

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS site_settings (
        key VARCHAR(100) PRIMARY KEY,
        value JSONB NOT NULL,
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
    console.error('Failed to initialize site_settings table:', err);
    throw err;
  }
}

export async function getSocialLinks(): Promise<SiteSocialLinks> {
  try {
    await initSettingsDb();
    const sql = getNeonSql();
    const rows = await sql`SELECT value FROM site_settings WHERE key = 'social_links' LIMIT 1;`;
    if (rows && rows.length > 0 && rows[0].value) {
      const val = typeof rows[0].value === 'string' ? JSON.parse(rows[0].value) : rows[0].value;
      return {
        ua: { ...DEFAULT_SOCIAL_LINKS.ua, ...(val.ua || {}) },
        en: { ...DEFAULT_SOCIAL_LINKS.en, ...(val.en || {}) },
      };
    }
    return DEFAULT_SOCIAL_LINKS;
  } catch (err) {
    console.error('getSocialLinks error, falling back to defaults:', err);
    return DEFAULT_SOCIAL_LINKS;
  }
}

export async function saveSocialLinks(links: SiteSocialLinks): Promise<SiteSocialLinks> {
  await initSettingsDb();
  const sql = getNeonSql();
  const cleaned: SiteSocialLinks = {
    ua: {
      telegram: links.ua?.telegram?.trim() || '',
      instagram: links.ua?.instagram?.trim() || '',
      x: links.ua?.x?.trim() || '',
      youtube: links.ua?.youtube?.trim() || '',
      threads: links.ua?.threads?.trim() || '',
    },
    en: {
      telegram: links.en?.telegram?.trim() || '',
      instagram: links.en?.instagram?.trim() || '',
      x: links.en?.x?.trim() || '',
      youtube: links.en?.youtube?.trim() || '',
      threads: links.en?.threads?.trim() || '',
    },
  };

  await sql`
    INSERT INTO site_settings (key, value, updated_at)
    VALUES ('social_links', ${JSON.stringify(cleaned)}, CURRENT_TIMESTAMP)
    ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP;
  `;

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
      const body = req.body;
      if (!body || typeof body !== 'object') {
        return res.status(400).json({ error: 'Недійсні дані запиту' });
      }
      const saved = await saveSocialLinks(body);
      return res.status(200).json(saved);
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('Social links handler error:', error);
    return res.status(500).json({ error: error.message || 'Server Error' });
  }
}
