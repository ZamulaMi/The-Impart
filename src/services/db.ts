import { neon } from '@neondatabase/serverless';
import { Article, SiteSocialLinks } from '../types';

const NEON_URL =
  'postgresql://neondb_owner:npg_YxGNIvz6CD1r@ep-dawn-dust-b7e8cria-pooler.c-13.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = neon(NEON_URL);

export async function fetchSocialLinksFromCloud(): Promise<SiteSocialLinks | null> {
  try {
    const rows = await sql`SELECT value FROM site_settings WHERE key = 'social_links' LIMIT 1;`;
    if (rows && rows.length > 0 && rows[0].value) {
      const val = typeof rows[0].value === 'string' ? JSON.parse(rows[0].value) : rows[0].value;
      return val as SiteSocialLinks;
    }
  } catch (err) {
    console.warn('Neon cloud direct fetch error:', err);
  }
  return null;
}

export async function saveSocialLinksToCloud(links: SiteSocialLinks): Promise<SiteSocialLinks> {
  const jsonStr = JSON.stringify(links);
  await sql`
    INSERT INTO site_settings (key, value, updated_at)
    VALUES ('social_links', ${jsonStr}, CURRENT_TIMESTAMP)
    ON CONFLICT (key) DO UPDATE
    SET value = ${jsonStr}, updated_at = CURRENT_TIMESTAMP;
  `;
  return links;
}

export async function fetchArticlesFromCloud(): Promise<Article[] | null> {
  try {
    const rows = await sql`SELECT * FROM articles ORDER BY created_at DESC;`;
    if (rows && Array.isArray(rows)) {
      return rows.map((r: any) => ({
        id: String(r.id),
        title: r.title || '',
        excerpt: r.excerpt || '',
        content: r.content || '',
        category: r.category || 'Загальне',
        date: r.date || '',
        author: r.author || 'Редакція The Impart',
        coverImage: r.cover_image || undefined,
        published: r.published === true || String(r.published) === 'true',
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
        titleEn: r.title_en || undefined,
        excerptEn: r.excerpt_en || undefined,
        contentEn: r.content_en || undefined,
        categoryEn: r.category_en || undefined,
        publishedEn: r.published_en === true || String(r.published_en) === 'true',
      }));
    }
  } catch (err) {
    console.warn('Neon cloud articles fetch error:', err);
  }
  return null;
}

export async function saveArticleToCloud(article: Article): Promise<Article> {
  const id = article.id || Date.now().toString();
  const title = article.title || '';
  const excerpt = article.excerpt || '';
  const content = article.content || '';
  const category = article.category || 'Загальне';
  const date = article.date || '';
  const author = article.author || 'Редакція The Impart';
  const coverImage = article.coverImage || null;
  const published = article.published ?? true;
  const titleEn = article.titleEn || null;
  const excerptEn = article.excerptEn || null;
  const contentEn = article.contentEn || null;
  const categoryEn = article.categoryEn || null;
  const publishedEn = article.publishedEn ?? false;

  await sql`
    INSERT INTO articles (
      id, title, excerpt, content, category, date, author, cover_image, published,
      title_en, excerpt_en, content_en, category_en, published_en
    ) VALUES (
      ${id}, ${title}, ${excerpt}, ${content}, ${category}, ${date}, ${author}, ${coverImage}, ${published},
      ${titleEn}, ${excerptEn}, ${contentEn}, ${categoryEn}, ${publishedEn}
    )
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      excerpt = EXCLUDED.excerpt,
      content = EXCLUDED.content,
      category = EXCLUDED.category,
      date = EXCLUDED.date,
      author = EXCLUDED.author,
      cover_image = EXCLUDED.cover_image,
      published = EXCLUDED.published,
      title_en = EXCLUDED.title_en,
      excerpt_en = EXCLUDED.excerpt_en,
      content_en = EXCLUDED.content_en,
      category_en = EXCLUDED.category_en,
      published_en = EXCLUDED.published_en;
  `;

  return { ...article, id };
}

export async function deleteArticleFromCloud(id: string): Promise<boolean> {
  await sql`DELETE FROM articles WHERE id = ${id};`;
  return true;
}
