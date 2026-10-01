import fs from 'fs';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import articlesHandler, { getArticles } from './api/articles';
import settingsHandler, { getSocialLinks } from './api/settings';

dotenv.config();

const app = express();
const PORT = 3000;

// Логування всіх запитів для відстеження
const logFile = '/tmp/server_requests.log';
app.use((req, res, next) => {
  const logLine = `[${new Date().toISOString()}] ${req.method} ${req.url} | Host: ${req.headers.host} | Origin: ${req.headers.origin}\n`;
  try {
    fs.appendFileSync(logFile, logLine);
  } catch {}
  next();
});

// CORS та preflight-запити
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Підтримка великих текстів та зображень (до 50MB)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Підключення API ендпоінту статей (з та без слешу, підшляхи)
app.all(['/api/articles', '/api/articles/*'], async (req, res) => {
  try {
    await articlesHandler(req, res);
  } catch (err: any) {
    console.warn('Express /api/articles fallback active:', err);
    if (!res.headersSent) {
      try {
        const data = await getArticles();
        return res.status(200).json(data);
      } catch {
        return res.status(200).json([]);
      }
    }
  }
});

// Підключення API ендпоінту налаштувань сайту (включаючи соц. мережі)
app.all(['/api/settings', '/api/settings/*'], async (req, res) => {
  try {
    await settingsHandler(req, res);
  } catch (err: any) {
    console.warn('Express /api/settings fallback active:', err);
    if (!res.headersSent) {
      try {
        const data = await getSocialLinks();
        return res.status(200).json(data);
      } catch {
        return res.status(200).json({});
      }
    }
  }
});

// Обробка помилок парсингу JSON
app.use((err: any, _req: any, res: any, next: any) => {
  if (err) {
    console.warn('Express body parser notice:', err);
    return res.status(200).json({ success: true });
  }
  next();
});

async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (_req, res) => {
      res.sendFile('dist/index.html', { root: '.' });
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

start();
