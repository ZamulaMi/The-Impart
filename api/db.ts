import { neon } from '@neondatabase/serverless';

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

// Початкові статті за замовчуванням
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

// Резервний рядок підключення до бази даних Neon
const DEFAULT_NEON_URL =
  'postgresql://neondb_owner:npg_YxGNIvz6CD1r@ep-dawn-dust-b7e8cria-pooler.c-13.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require';

// Очищення рядка підключення від psql, назви змінної, лапок, пробілів та крапки з комою
export function cleanConnectionString(raw?: string): string | undefined {
  if (!raw) return undefined;
  const str = raw.trim();

  // Витягуємо безпосередньо URL підключення postgres:// або postgresql://
  const match = str.match(/postgres(?:ql)?:\/\/[^\s"'\`]+/i);
  if (match) {
    let extracted = match[0].trim();
    // Видаляємо кінцеві лапки, крапки з комою та слеші
    extracted = extracted.replace(/[;"'\`\\]+$/, '').trim();
    return extracted;
  }

  return undefined;
}

// Отримання клієнта Neon
export function getNeonSql() {
  const candidateKeys = [
    'DATABASE_URL',
    'POSTGRES_URL',
    'POSTGRES_PRISMA_URL',
    'DATABASE_URL_UNPOOLED',
    'POSTGRES_URL_NON_POOLING',
    'POSTGRES_URL_NO_SSL',
  ] as const;

  let connectionString: string | undefined;

  for (const k of candidateKeys) {
    const val = cleanConnectionString(process.env[k]);
    if (val) {
      connectionString = val;
      break;
    }
  }

  // Якщо через окремі змінні PGUSER / PGHOST
  if (!connectionString && process.env.PGUSER && process.env.PGHOST && process.env.PGDATABASE) {
    const user = process.env.PGUSER;
    const pass = process.env.PGPASSWORD || '';
    const host = process.env.PGHOST;
    const db = process.env.PGDATABASE;
    connectionString = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}/${db}?sslmode=require`;
  }

  if (!connectionString) {
    connectionString = DEFAULT_NEON_URL;
  }

  return neon(connectionString);
}

let isTableInitialized = false;

export async function initDb() {
  if (isTableInitialized) return;

  const sql = getNeonSql();

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

    // Перевіряємо, чи є статті
    const rows = await sql`SELECT count(*) as count FROM articles;`;
    if (parseInt(rows[0]?.count || '0', 10) === 0) {
      for (const a of DEFAULT_ARTICLES) {
        await sql`
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
    console.log('Postgres table "articles" is ready via @neondatabase/serverless.');
  } catch (error) {
    console.error('Failed to initialize Postgres table with Neon:', error);
    throw error;
  }
}

export async function getArticles(): Promise<Article[]> {
  try {
    await initDb();
    const sql = getNeonSql();
    const rows = await sql`
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
    console.error('Neon query error in getArticles:', error);
    return DEFAULT_ARTICLES;
  }
}

export async function saveArticle(article: Article): Promise<Article> {
  await initDb();
  const sql = getNeonSql();

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

  try {
    await sql`
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

    console.log(`Article "${title}" (ID: ${id}) successfully saved to Neon.`);
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
    console.error('Failed to save article to Neon:', error);
    throw new Error(error?.message || 'Помилка збереження у базу даних Neon');
  }
}

export async function deleteArticle(id: string): Promise<boolean> {
  await initDb();
  const sql = getNeonSql();

  try {
    await sql`DELETE FROM articles WHERE id = ${String(id)};`;
    console.log(`Article ${id} deleted from Neon.`);
    return true;
  } catch (error) {
    console.error('Failed to delete article from Neon:', error);
    throw error;
  }
}
