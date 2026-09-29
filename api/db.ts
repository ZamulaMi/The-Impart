import { sql } from '@vercel/postgres';
import { Article } from '../src/types';

let isTableInitialized = false;

// Резервне сховище у пам'яті (порожнє за замовчуванням)
let memoryArticles: Article[] = [];

export async function initDb() {
  if (isTableInitialized) return;
  if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
    isTableInitialized = true;
    return;
  }

  try {
    await sql`
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
  } catch (error) {
    console.error('Failed to initialize Postgres table:', error);
  }
}

export async function getArticles(): Promise<Article[]> {
  if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
    return memoryArticles;
  }

  try {
    await initDb();
    const { rows } = await sql`
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
  if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
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
    await sql`
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
    // Зберігаємо також у пам'ять, щоб дані не втратились
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

  if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
    return true;
  }

  try {
    await initDb();
    await sql`DELETE FROM articles WHERE id = ${id};`;
    return true;
  } catch (error) {
    console.error('Failed to delete article from database:', error);
    return true;
  }
}
