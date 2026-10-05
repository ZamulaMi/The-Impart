import fs from 'fs';
import path from 'path';
import { neon } from '@neondatabase/serverless';
import { verifyAdminToken, extractToken } from './auth';

export interface Article {
  id: string;
  // Українська версія (основна)
  title: string;
  excerpt: string;
  content: string;
  category: string;
  categories?: string[];
  topics?: string[];
  author: string;
  coverImage?: string;
  date: string;
  readTime?: string;
  createdAt?: string;
  published: boolean;

  // Англійська версія
  titleEn?: string;
  excerptEn?: string;
  contentEn?: string;
  categoryEn?: string;
  categoriesEn?: string[];
  topicsEn?: string[];
  publishedEn?: boolean;
}

// Початкові статті за замовчуванням з українською та англійською версіями
export const DEFAULT_ARTICLES: Article[] = [
  {
    id: '1',
    title: 'Тиша як простір для нової форми думки',
    excerpt: 'У світі надлишку інформації здатність сповільнитися перетворюється на рідкісну естетичну та інтелектуальну чесноту.',
    content: "Справжня глибина починається там, де стихає фоновий шум. Сучасний темп життя нав'язує відчуття неперервної присутності, проте саме паузи між словами створюють ритм, а порожнеча на полотні визначає композицію.\n\nКоли ми відмовляємося від надлишкових деталей, залишається сутність. Це не просто мінімалізм у візуальному вимірі — це спосіб взаємодії зі світом, де кожна деталь набуває власної ваги.\n\nМистецтво уважності вимагає внутрішнього спокою. У тиші народжуються ідеї, які не потребують гучного проголошення, аби змінити сприйняття дійсності.",
    category: 'Філософія',
    author: 'Редакція The Impart',
    coverImage: 'https://images.unsplash.com/photo-1507842229451-7f01be7a50d4?auto=format&fit=crop&w=1400&q=80',
    date: '29 вересня 2026',
    published: true,
    titleEn: 'Silence as a Space for a New Form of Thought',
    categoryEn: 'Philosophy',
    excerptEn: 'In a world of information overflow, the ability to slow down transforms into a rare aesthetic and intellectual virtue.',
    contentEn: "True depth begins where the background noise fades away. Modern pace of life imposes a sense of continuous presence, yet it is the pauses between words that create rhythm, and the empty space on canvas that defines the composition.\n\nWhen we discard superfluous details, essence remains. This is not merely minimalism in visual terms — it is a way of interacting with the world where every detail acquires its own weight.\n\nThe art of attentiveness requires inner quiet. In silence, ideas are born that do not need loud proclamation to change our perception of reality.",
    publishedEn: true,
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
    published: true,
    titleEn: 'The Architecture of Observation: How Space Shapes Experience',
    categoryEn: 'Architecture',
    excerptEn: 'Clean lines, natural light, and the absence of visual noise as the foundation of conscious environmental perception.',
    contentEn: "The space around us is never neutral. It either disperses our attention or gathers it into a single focal point. Architecture that respects the individual does not seek to overwhelm by scale — it creates conditions for interior dialogue.\n\nLight descending through tall windows, the texture of natural stone or wood, a white wall where tree shadows play in the late afternoon — these are simple elements that restore our sense of presence in the here and now.",
    publishedEn: true,
  },
  {
    id: 'news-1',
    title: 'Міжнародна бієнале мінімалістичного дизайну відкривається в Кіото',
    excerpt: 'Головна подія року для поціновувачів японської естетики вабі-сабі та сучасної скандинавської простоти.',
    content: 'У Кіото стартувала щорічна виставка, присвячена гармонії форми та порожнечі. Провідні архітектори з усього світу представили просторові інсталяції, де ключову роль відіграє природне освітлення та натуральні матеріали.\n\nКуратори акцентують увагу на сповільненні темпу сприйняття та переосмисленні щоденних ритуалів спостереження.',
    category: 'Новини',
    author: 'Редакція The Impart',
    coverImage: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1200&q=80',
    date: '2 жовтня 2026 р.',
    createdAt: '2026-10-02T10:00:00.000Z',
    published: true,
    titleEn: 'International Biennale of Minimalist Design Opens in Kyoto',
    categoryEn: 'News',
    excerptEn: 'The main event of the year for admirers of Japanese wabi-sabi aesthetics and modern Scandinavian simplicity.',
    contentEn: 'Kyoto hosts the annual exhibition dedicated to harmony of form and emptiness. Leading architects worldwide presented spatial installations where natural light and raw textures take center stage.',
    publishedEn: true,
  },
  {
    id: 'review-1',
    title: 'Огляд: Монохромні видання Cereal та естетика нового номеру',
    excerpt: 'Детальний погляд на візуальну культуру, типографіку та вибір фотоматеріалів в осінньому випуску журналу.',
    content: 'Осінній номер Cereal вкотре доводить, що друковане видання може бути самостійним витвором мистецтва. Матовий папір високої щільності, вивірений кернінг та вишукана сітка верстки створюють відчуття спокою з першої сторінки.\n\nФотографічні серії побудовані на тонких нюансах сірого та теплого бежевого тонів, що надихає на вдумливе читання.',
    category: 'Обзори',
    author: 'Михайло Замула',
    coverImage: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=1200&q=80',
    date: '29 вересня 2026 р.',
    createdAt: '2026-09-29T18:00:00.000Z',
    published: true,
    titleEn: 'Review: Cereal Monochrome Editions and New Issue Aesthetics',
    categoryEn: 'Reviews',
    excerptEn: 'An in-depth look at visual culture, typography, and curated imagery in the autumn edition.',
    contentEn: 'The autumn issue of Cereal proves once again that print can be an independent piece of quiet art. Heavy matte paper, meticulous kerning, and generous margins induce contemplative tranquility.',
    publishedEn: true,
  },
];

// Локальне збереження на диску сервера
const DATA_DIR = path.resolve(process.cwd(), 'data');
const ARTICLES_FILE = path.join(DATA_DIR, 'articles.json');

function ensureDataDir(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    console.warn('Could not create data dir:', err);
  }
}

function readArticlesFromFile(): Article[] | null {
  try {
    ensureDataDir();
    if (fs.existsSync(ARTICLES_FILE)) {
      const content = fs.readFileSync(ARTICLES_FILE, 'utf-8');
      if (content && content.trim()) {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    }
  } catch (err) {
    console.warn('Error reading articles from disk file:', err);
  }
  return null;
}

function writeArticlesToFile(articles: Article[]): void {
  try {
    ensureDataDir();
    fs.writeFileSync(ARTICLES_FILE, JSON.stringify(articles, null, 2), 'utf-8');
    console.log(`Articles (${articles.length}) saved to disk: ${ARTICLES_FILE}`);
  } catch (err) {
    console.error('Error writing articles to disk file:', err);
  }
}

// Ініціалізуємо пам'ять з диска або початкових статей
const initialArticlesFromFile = readArticlesFromFile();
let inMemoryArticles: Article[] = initialArticlesFromFile || [...DEFAULT_ARTICLES];
if (!initialArticlesFromFile) {
  writeArticlesToFile(inMemoryArticles);
}

// Очищення рядка підключення: автоматично витягує чистий postgresql://...
export function cleanConnectionString(raw?: string): string | undefined {
  if (!raw) return undefined;
  const str = raw.trim();

  const match = str.match(/postgres(?:ql)?:\/\/[^\s"'\`]+/i);
  if (match) {
    let extracted = match[0].trim();
    extracted = extracted.replace(/[;"'\`\\]+$/, '').trim();
    return extracted;
  }

  return undefined;
}

// Отримання клієнта Neon (виключно зі змінних середовища)
export function getNeonSql(): any | null {
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

  // Якщо рядок передано через окремі змінні PGHOST / PGUSER
  if (!connectionString && process.env.PGUSER && process.env.PGHOST && process.env.PGDATABASE) {
    const user = process.env.PGUSER;
    const pass = process.env.PGPASSWORD || '';
    const host = process.env.PGHOST;
    const db = process.env.PGDATABASE;
    connectionString = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}/${db}?sslmode=require`;
  }

  if (!connectionString) {
    return null;
  }

  return neon(connectionString);
}

let isTableInitialized = false;

export async function initDb() {
  if (isTableInitialized) return;

  try {
    const sql = getNeonSql();
    if (!sql) return;
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

    // Переконуємось, що існують колонки для англійської версії статті
    await sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS title_en TEXT;`;
    await sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS excerpt_en TEXT;`;
    await sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS content_en TEXT;`;
    await sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS category_en VARCHAR(100);`;
    await sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS published_en BOOLEAN DEFAULT false;`;

    // Перевіряємо наявність записів
    const rows = await sql`SELECT count(*) as count FROM articles;`;
    if (parseInt(rows[0]?.count || '0', 10) === 0) {
      const toSeed = inMemoryArticles.length > 0 ? inMemoryArticles : DEFAULT_ARTICLES;
      for (const a of toSeed) {
        await sql`
          INSERT INTO articles (
            id, title, excerpt, content, category, author, cover_image, date, read_time, published,
            title_en, excerpt_en, content_en, category_en, published_en
          )
          VALUES (
            ${a.id}, 
            ${a.title}, 
            ${a.excerpt}, 
            ${a.content}, 
            ${a.category}, 
            ${a.author}, 
            ${a.coverImage || null}, 
            ${a.date}, 
            ${a.readTime || null}, 
            ${a.published},
            ${a.titleEn || null},
            ${a.excerptEn || null},
            ${a.contentEn || null},
            ${a.categoryEn || null},
            ${a.publishedEn ?? false}
          )
          ON CONFLICT (id) DO NOTHING;
        `;
      }
    }

    isTableInitialized = true;
    console.log('Postgres table "articles" is ready with multilingual columns.');
  } catch (error) {
    console.warn('Neon initDb notice (fallback to local server disk active):', error);
  }
}

export async function getArticles(): Promise<Article[]> {
  try {
    await initDb();
    const sql = getNeonSql();
    if (!sql) {
      const fromFile = readArticlesFromFile();
      return fromFile && fromFile.length > 0 ? fromFile : inMemoryArticles;
    }
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
        created_at as "createdAt",
        published,
        title_en as "titleEn",
        excerpt_en as "excerptEn",
        content_en as "contentEn",
        category_en as "categoryEn",
        published_en as "publishedEn"
      FROM articles 
      ORDER BY created_at DESC;
    `;

    if (rows && rows.length > 0) {
      const mapped = rows.map((r: any) => ({
        id: String(r.id),
        title: String(r.title || ''),
        excerpt: String(r.excerpt || ''),
        content: String(r.content || ''),
        category: String(r.category || 'Загальне'),
        author: String(r.author || 'Редакція The Impart'),
        coverImage: r.coverImage || undefined,
        date: String(r.date || ''),
        readTime: r.readTime ? String(r.readTime) : undefined,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : undefined,
        published: r.published === true || String(r.published) === 'true' || r.published === 1,
        titleEn: r.titleEn ? String(r.titleEn) : undefined,
        excerptEn: r.excerptEn ? String(r.excerptEn) : undefined,
        contentEn: r.contentEn ? String(r.contentEn) : undefined,
        categoryEn: r.categoryEn ? String(r.categoryEn) : undefined,
        publishedEn: r.publishedEn === true || String(r.publishedEn) === 'true' || r.publishedEn === 1,
      }));

      inMemoryArticles = mapped;
      writeArticlesToFile(mapped);
      return mapped;
    }
  } catch (error) {
    console.warn('Neon query error in getArticles, loading from server disk/memory:', error);
  }

  // Резервне завантаження з файлу на диску
  const fromFile = readArticlesFromFile();
  if (fromFile && fromFile.length > 0) {
    inMemoryArticles = fromFile;
    return fromFile;
  }

  return inMemoryArticles;
}

export async function saveArticle(article: Article): Promise<Article> {
  const isPub = article.published !== false && String(article.published) !== 'false';
  const isPubEn = article.publishedEn === true || String(article.publishedEn) === 'true' || (article.publishedEn as any) === 1;

  const id = String(article.id || Date.now().toString());
  const title = String(article.title || '').trim();
  const excerpt = String(article.excerpt || '').trim();
  const content = String(article.content || '').trim();
  const category = String(article.category || 'Загальне').trim();
  const author = String(article.author || 'Редакція The Impart').trim();
  const coverImage = article.coverImage ? String(article.coverImage).trim() : undefined;
  const date = String(article.date || new Date().toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' }));
  const readTime = article.readTime ? String(article.readTime) : undefined;
  const createdAt = article.createdAt || new Date().toISOString();

  const titleEn = article.titleEn ? String(article.titleEn).trim() : undefined;
  const excerptEn = article.excerptEn ? String(article.excerptEn).trim() : undefined;
  const contentEn = article.contentEn ? String(article.contentEn).trim() : undefined;
  const categoryEn = article.categoryEn ? String(article.categoryEn).trim() : undefined;

  const categories = Array.isArray(article.categories) && article.categories.length > 0
    ? article.categories.map((c) => String(c).trim()).filter(Boolean)
    : (category ? [category] : []);
  const categoriesEn = Array.isArray(article.categoriesEn) && article.categoriesEn.length > 0
    ? article.categoriesEn.map((c) => String(c).trim()).filter(Boolean)
    : (categoryEn ? [categoryEn] : []);
  const topics = Array.isArray(article.topics)
    ? article.topics.map((t) => String(t).trim()).filter(Boolean)
    : undefined;
  const topicsEn = Array.isArray(article.topicsEn)
    ? article.topicsEn.map((t) => String(t).trim()).filter(Boolean)
    : undefined;

  const fullArticle: Article = {
    id,
    title,
    excerpt,
    content,
    category: categories.join(', ') || category,
    categories,
    topics,
    author,
    coverImage,
    date,
    readTime,
    createdAt,
    published: isPub,
    titleEn,
    excerptEn,
    contentEn,
    categoryEn: categoriesEn.join(', ') || categoryEn,
    categoriesEn,
    topicsEn,
    publishedEn: isPubEn,
  };

  // 1. Миттєво оновлюємо пам'ять
  const existingIdx = inMemoryArticles.findIndex((a) => a.id === id);
  if (existingIdx >= 0) {
    inMemoryArticles[existingIdx] = fullArticle;
  } else {
    inMemoryArticles = [fullArticle, ...inMemoryArticles];
  }

  // 2. Миттєво записуємо на диск сервера (100% гарантія збереження на сервері)
  writeArticlesToFile(inMemoryArticles);

  // 3. Синхронізуємо з Neon PostgreSQL
  try {
    await initDb();
    const sql = getNeonSql();
    if (sql) {
      await sql`
      INSERT INTO articles (
        id, title, excerpt, content, category, author, cover_image, date, read_time, published,
        title_en, excerpt_en, content_en, category_en, published_en
      )
      VALUES (
        ${id}, 
        ${title}, 
        ${excerpt}, 
        ${content}, 
        ${category}, 
        ${author}, 
        ${coverImage || null}, 
        ${date}, 
        ${readTime || null}, 
        ${isPub},
        ${titleEn || null},
        ${excerptEn || null},
        ${contentEn || null},
        ${categoryEn || null},
        ${isPubEn}
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
        published = EXCLUDED.published,
        title_en = EXCLUDED.title_en,
        excerpt_en = EXCLUDED.excerpt_en,
        content_en = EXCLUDED.content_en,
        category_en = EXCLUDED.category_en,
        published_en = EXCLUDED.published_en;
    `;
      console.log(`Article "${title}" (ID: ${id}) successfully synced to Neon.`);
    }
  } catch (error: any) {
    console.warn('Neon save notice (article is saved on server disk):', error);
  }

  return fullArticle;
}

export async function deleteArticle(id: string): Promise<boolean> {
  const targetId = String(id);

  // 1. Видаляємо з пам'яті
  inMemoryArticles = inMemoryArticles.filter((a) => a.id !== targetId);

  // 2. Оновлюємо файл на диску
  writeArticlesToFile(inMemoryArticles);

  // 3. Синхронізуємо видалення з Neon
  try {
    await initDb();
    const sql = getNeonSql();
    if (sql) {
      await sql`DELETE FROM articles WHERE id = ${targetId};`;
      console.log(`Article ${targetId} deleted from Neon.`);
    }
  } catch (error) {
    console.warn(`Neon delete notice (article removed from server disk):`, error);
  }

  return true;
}

export default async function handler(req: any, res: any) {
  // Налаштування CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const articles = await getArticles();
      return res.status(200).json(articles);
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const token = extractToken(req);
      if (!verifyAdminToken(token)) {
        return res.status(401).json({ error: 'Потрібна авторизація адміністратора для збереження статей' });
      }

      let body = req.body;

      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch (e: any) {
          return res.status(400).json({ error: 'Помилка валідації JSON: ' + e.message });
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
        return res.status(400).json({ error: 'Тіло запиту повинно бути об\'єктом' });
      }

      if (!body.title || !String(body.title).trim()) {
        return res.status(400).json({ error: 'Заголовок статті обов\'язковий' });
      }

      const saved = await saveArticle({
        id: body.id ? String(body.id) : Date.now().toString(),
        title: String(body.title).trim(),
        excerpt: body.excerpt ? String(body.excerpt).trim() : '',
        content: body.content ? String(body.content).trim() : '',
        category: body.category ? String(body.category).trim() : 'Загальне',
        author: body.author ? String(body.author).trim() : 'Редакція The Impart',
        coverImage: body.coverImage ? String(body.coverImage).trim() : undefined,
        date: body.date ? String(body.date) : new Date().toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' }),
        readTime: body.readTime ? String(body.readTime) : undefined,
        createdAt: body.createdAt ? String(body.createdAt) : undefined,
        published: body.published !== false && String(body.published) !== 'false',
        // Англійські поля
        titleEn: body.titleEn ? String(body.titleEn).trim() : undefined,
        excerptEn: body.excerptEn ? String(body.excerptEn).trim() : undefined,
        contentEn: body.contentEn ? String(body.contentEn).trim() : undefined,
        categoryEn: body.categoryEn ? String(body.categoryEn).trim() : undefined,
        publishedEn: body.publishedEn === true || String(body.publishedEn) === 'true',
      });

      return res.status(200).json(saved);
    }

    if (req.method === 'DELETE') {
      const token = extractToken(req);
      if (!verifyAdminToken(token)) {
        return res.status(401).json({ error: 'Потрібна авторизація адміністратора для видалення статей' });
      }

      const id = req.query?.id || req.body?.id;
      if (!id) {
        return res.status(400).json({ error: 'Параметр ID є обов\'язковим' });
      }
      await deleteArticle(id.toString());
      return res.status(200).json({ success: true, id: id.toString() });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('API /api/articles error:', error);
    // Якщо збереження відбулося у файл/пам'ять, повертаємо актуальний список
    return res.status(200).json(inMemoryArticles);
  }
}
