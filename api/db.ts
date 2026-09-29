import { createPool, VercelPool } from '@vercel/postgres';

export interface Article {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  author: string;
  coverImage?: string;
  date: string;
  readTime: string;
  published: boolean;
}

// Початкові статті
const DEFAULT_ARTICLES: Article[] = [
  {
    id: '1',
    title: 'Тиша як простір для нової форми думки',
    excerpt: 'У світі надлишку інформації здатність сповільнитися перетворюється на рідкісну естетичну та інтелектуальну чесноту.',
    content: "Справжня глибина починається там, де стихає фоновий шум. Сучасний темп життя нав'язує відчуття неперервної присутності, проте саме паузи між словами створюють ритм, а порожнеча на полотні визначає композицію.\n\nКоли ми відмовляємося від надлишкових деталей, залишається сутність. Це не просто мінімалізм у візуальному вимірі — це спосіб взаємодії зі світом, де кожна деталь набуває власної ваги.\n\nМистецтво уважності вимагає внутрішнього спокою. У тиші народжуються ідеї, які не потребують гучного проголошення, аби змінити сприйняття дійсності.",
    category: 'Філософія',
    author: 'Редакція The Impart',
    coverImage: 'https://images.unsplash.com/photo-1507842229451-7f01be7a50d4?auto=format&fit=crop&w=1400&q=80',
    date: '29 вересня 2026',
    readTime: '4 хв читання',
    published: true,
  },
  {
    id: '2',
    title: 'Архітектура спостереження: як простір формує досвід',
    excerpt: 'Чисті лінії, природне світло та відсутність візуального шуму як основа свідомого сприйняття навколишнього середовища.',
    content: "Простір навколо нас не є нейтральним. Він або розсіює нашу увагу, або збирає її в одну фокусну точку. Архітектура, яка поважає людину, не намагається вразити масштабом — вона створює умови для внутрішнього діалогу.\n\nСвітло, що падає крізь високі вікна, текстура натурального каменю чи дерева, біла стіна, на якій грають тіні дерев у другій половині дня — це прості речі, що повертають відчуття присутності тут і тепер.",
    category: 'Архітектура',
    author: 'Олена Кравченко',
    coverImage: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1400&q=80',
    date: '28 вересня 2026',
    readTime: '3 хв читання',
    published: true,
  },
];

// Пряме підключення до Neon (пул PgBouncer)
const DEFAULT_NEON_POOLED_URL =
  'postgresql://neondb_owner:npg_YxGNIvz6CD1r@ep-dawn-dust-b7e8cria-pooler.c-13.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require';

// Очищення рядка від "=", лапок та пробілів
export function cleanConnectionString(url?: string): string | undefined {
  if (!url) return undefined;
  let cleaned = url.trim();

  let prev = '';
  while (cleaned && cleaned !== prev) {
    prev = cleaned;
    cleaned = cleaned.replace(/^[=\s"'\\]+/, '').replace(/[=\s"'\\]+$/, '').trim();
  }

  return cleaned || undefined;
}

// Гарантуємо використання пулера (-pooler.) для Neon, оскільки createPool у @vercel/postgres вимагає саме його
export function ensureNeonPooler(url?: string): string | undefined {
  if (!url) return undefined;
  if (url.includes('-pooler.')) return url;
  if (url.includes('.neon.tech')) {
    // Вставляємо -pooler перед першою крапкою в хості
    return url
      .replace(/@([a-z0-9-]+)(\.[a-z0-9-]+\.[a-z0-9-]+\.aws\.neon\.tech)/i, '@$1-pooler$2')
      .replace(/@([a-z0-9-]+)(\.[a-z0-9-]+\.neon\.tech)/i, '@$1-pooler$2');
  }
  return url;
}

// Очищуємо всі відомі змінні підключення до Postgres
export function sanitizeEnvironment() {
  const keys = [
    'DATABASE_URL',
    'DATABASE_URL_UNPOOLED',
    'POSTGRES_URL',
    'POSTGRES_PRISMA_URL',
    'POSTGRES_URL_NON_POOLING',
    'POSTGRES_URL_NO_SSL',
  ] as const;

  for (const k of keys) {
    if (process.env[k]) {
      const cleaned = cleanConnectionString(process.env[k]);
      if (cleaned) {
        process.env[k] = cleaned;
      }
    }
  }
}

sanitizeEnvironment();

let pool: VercelPool | null = null;
let isTableInitialized = false;

export function getDbPool(): VercelPool | null {
  if (pool) return pool;

  sanitizeEnvironment();

  // Пріоритет віддається пул-з'єднанням
  const candidateUrls = [
    process.env.POSTGRES_URL,
    process.env.DATABASE_URL,
    process.env.POSTGRES_PRISMA_URL,
    process.env.POSTGRES_URL_NON_POOLING,
    process.env.DATABASE_URL_UNPOOLED,
    process.env.POSTGRES_URL_NO_SSL,
  ];

  let rawString: string | undefined;
  for (const candidate of candidateUrls) {
    const cleaned = cleanConnectionString(candidate);
    if (cleaned) {
      rawString = cleaned;
      break;
    }
  }

  // Якщо рядок не знайдено, перевіряємо параметри PGUSER / PGHOST
  if (!rawString && process.env.PGUSER && process.env.PGHOST && process.env.PGDATABASE) {
    const user = process.env.PGUSER;
    const pass = process.env.PGPASSWORD || '';
    const host = process.env.PGHOST;
    const db = process.env.PGDATABASE;
    rawString = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}/${db}?sslmode=require`;
  }

  // Якщо все ще порожньо, використовуємо конфігурацію бази Neon
  if (!rawString) {
    rawString = DEFAULT_NEON_POOLED_URL;
  }

  // Забезпечуємо пул-версію URL для @vercel/postgres
  const connectionString = ensureNeonPooler(rawString) || rawString;

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

    // Перевіряємо наявність записів
    const { rows } = await db.sql`SELECT count(*) as count FROM articles;`;
    if (parseInt(rows[0]?.count || '0', 10) === 0) {
      for (const a of DEFAULT_ARTICLES) {
        await db.sql`
          INSERT INTO articles (id, title, excerpt, content, category, author, cover_image, date, read_time, published)
          VALUES (
            ${a.id}, 
            ${a.title}, 
            ${a.excerpt}, 
            ${a.content}, 
            ${a.category}, 
            ${a.author}, 
            ${a.coverImage || null}, 
            ${a.date}, 
            ${a.readTime}, 
            ${a.published}
          )
          ON CONFLICT (id) DO NOTHING;
        `;
      }
    }

    isTableInitialized = true;
    console.log('Postgres table "articles" is ready.');
  } catch (error) {
    console.error('Failed to initialize Postgres table:', error);
    pool = null; // скидаємо пул для повторного підключення
    throw error;
  }
}

export async function getArticles(): Promise<Article[]> {
  const db = getDbPool();
  if (!db) {
    return DEFAULT_ARTICLES;
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
    return rows.map((r: any) => ({
      id: String(r.id),
      title: String(r.title || ''),
      excerpt: String(r.excerpt || ''),
      content: String(r.content || ''),
      category: String(r.category || 'Загальне'),
      author: String(r.author || 'Редакція The Impart'),
      coverImage: r.coverImage || undefined,
      date: String(r.date || ''),
      readTime: String(r.readTime || '3 хв читання'),
      published: r.published === true || String(r.published) === 'true' || r.published === 1,
    }));
  } catch (error) {
    console.error('Database query error:', error);
    pool = null;
    return DEFAULT_ARTICLES;
  }
}

export async function saveArticle(article: Article): Promise<Article> {
  const db = getDbPool();
  if (!db) {
    throw new Error('База даних недоступна. Перевірте змінні середовища.');
  }

  try {
    await initDb();
    const isPub = article.published !== false && String(article.published) !== 'false';
    const id = String(article.id || Date.now().toString());
    const title = String(article.title || '').trim();
    const excerpt = String(article.excerpt || '').trim();
    const content = String(article.content || '').trim();
    const category = String(article.category || 'Загальне').trim();
    const author = String(article.author || 'Редакція The Impart').trim();
    const coverImage = article.coverImage ? String(article.coverImage).trim() : null;
    const date = String(article.date || new Date().toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' }));
    const readTime = String(article.readTime || '3 хв читання');

    await db.sql`
      INSERT INTO articles (id, title, excerpt, content, category, author, cover_image, date, read_time, published)
      VALUES (
        ${id}, 
        ${title}, 
        ${excerpt}, 
        ${content}, 
        ${category}, 
        ${author}, 
        ${coverImage}, 
        ${date}, 
        ${readTime}, 
        ${isPub}
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
    console.log(`Article "${title}" (ID: ${id}) successfully saved to Postgres.`);
    return {
      id,
      title,
      excerpt,
      content,
      category,
      author,
      coverImage: coverImage || undefined,
      date,
      readTime,
      published: isPub,
    };
  } catch (error: any) {
    console.error('Failed to save article to database:', error);
    pool = null; // Скидаємо пул для реконнекту при наступному запиті
    throw new Error(error?.message || 'Помилка збереження у базу даних');
  }
}

export async function deleteArticle(id: string): Promise<boolean> {
  const db = getDbPool();
  if (!db) {
    return true;
  }

  try {
    await initDb();
    await db.sql`DELETE FROM articles WHERE id = ${String(id)};`;
    return true;
  } catch (error) {
    console.error('Failed to delete article from database:', error);
    pool = null;
    throw error;
  }
}
