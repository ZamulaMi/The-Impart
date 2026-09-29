import { createPool, VercelPool } from '@vercel/postgres';
import { Article } from '../src/types';

// Очищення рядка підключення від випадкового знаку "=" на початку, лапок та пробілів
export function cleanConnectionString(url?: string): string | undefined {
  if (!url) return undefined;
  let cleaned = url.trim();

  // Видаляємо зайві лапки
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  // Видаляємо випадкові знаки "=" на початку (наприклад, якщо скопіювали разом із назвою змінної)
  while (cleaned.startsWith('=')) {
    cleaned = cleaned.slice(1).trim();
  }

  return cleaned || undefined;
}

// Оновлюємо системні змінні середовища з очищеними значеннями
function sanitizeEnvironment() {
  if (process.env.POSTGRES_URL) {
    process.env.POSTGRES_URL = cleanConnectionString(process.env.POSTGRES_URL);
  }
  if (process.env.DATABASE_URL) {
    process.env.DATABASE_URL = cleanConnectionString(process.env.DATABASE_URL);
  }
  if (process.env.POSTGRES_PRISMA_URL) {
    process.env.POSTGRES_PRISMA_URL = cleanConnectionString(process.env.POSTGRES_PRISMA_URL);
  }
  if (process.env.POSTGRES_URL_NON_POOLING) {
    process.env.POSTGRES_URL_NON_POOLING = cleanConnectionString(process.env.POSTGRES_URL_NON_POOLING);
  }
}

sanitizeEnvironment();

let pool: VercelPool | null = null;
let isTableInitialized = false;

// Резервне сховище у пам'яті (тільки якщо база даних взагалі недоступна)
let memoryArticles: Article[] = [];

function getDbPool(): VercelPool | null {
  if (pool) return pool;

  sanitizeEnvironment();
  const rawUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  const connectionString = cleanConnectionString(rawUrl);

  if (!connectionString) {
    return null;
  }

  try {
    pool = createPool({ connectionString });
    return pool;
  } catch (err) {
    console.error('Error creating Postgres pool:', err);
    return null;
  }
}

export async function initDb() {
  if (isTableInitialized) return;

  const db = getDbPool();
  if (!db) {
    isTableInitialized = true;
    return;
  }

  try {
    await db.sql`
      CREATE TABLE IF NOT EXISTS articles (
        id VARCHAR(255) PRIMARY KEY,
        title TEXT NOT NULL,
        excerpt TEXT,
        content TEXT NOT NULL,
        category VARCHAR(100) DEFAULT 'Загальне',
        author VARCHAR(255) DEFAULT 'Редакція The Impart',
        cover_image TEXT,
        date VARCHAR(100),
        read_time VARCHAR(100),
        published BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    isTableInitialized = true;
    console.log('Postgres table "articles" is ready.');
  } catch (error) {
    console.error('Failed to initialize Postgres table:', error);
  }
}

export async function getArticles(): Promise<Article[]> {
  const db = getDbPool();
  if (!db) {
    return memoryArticles;
  }

  try {
    await initDb();
    const { rows } = await db.sql`
      SELECT 
        id, 
        title, 
        excerpt, 
        content, 
        category, 
        author, 
        cover_image as "coverImage", 
        date, 
        read_time as "readTime", 
        published 
      FROM articles 
      ORDER BY created_at DESC;
    `;
    return rows as Article[];
  } catch (error) {
    console.error('Database query error, returning fallback:', error);
    return memoryArticles;
  }
}

export async function saveArticle(article: Article): Promise<Article> {
  const db = getDbPool();
  if (!db) {
    const idx = memoryArticles.findIndex((a) => a.id === article.id);
    if (idx >= 0) {
      memoryArticles[idx] = article;
    } else {
      memoryArticles = [article, ...memoryArticles];
    }
    return article;
  }

  try {
    await initDb();
    await db.sql`
      INSERT INTO articles (id, title, excerpt, content, category, author, cover_image, date, read_time, published)
      VALUES (
        ${article.id}, 
        ${article.title}, 
        ${article.excerpt}, 
        ${article.content}, 
        ${article.category}, 
        ${article.author}, 
        ${article.coverImage || null}, 
        ${article.date}, 
        ${article.readTime}, 
        ${article.published}
      )
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        excerpt = EXCLUDED.excerpt,
        content = EXCLUDED.content,
        category = EXCLUDED.category,
        author = EXCLUDED.author,
        cover_image = EXCLUDED.cover_image,
        date = EXCLUDED.date,
        read_time = EXCLUDED.read_time,
        published = EXCLUDED.published;
    `;
    return article;
  } catch (error) {
    console.error('Failed to save article to database:', error);
    const idx = memoryArticles.findIndex((a) => a.id === article.id);
    if (idx >= 0) {
      memoryArticles[idx] = article;
    } else {
      memoryArticles = [article, ...memoryArticles];
    }
    return article;
  }
}

export async function deleteArticle(id: string): Promise<boolean> {
  memoryArticles = memoryArticles.filter((a) => a.id !== id);

  const db = getDbPool();
  if (!db) {
    return true;
  }

  try {
    await initDb();
    await db.sql`DELETE FROM articles WHERE id = ${id};`;
    return true;
  } catch (error) {
    console.error('Failed to delete article from database:', error);
    return true;
  }
}
