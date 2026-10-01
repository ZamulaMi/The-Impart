import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import articlesHandler from './api/articles';
import settingsHandler from './api/settings';

dotenv.config();

const app = express();
const PORT = 3000;

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

// Підключення API ендпоінту статей (з та без слешу)
app.all(['/api/articles', '/api/articles/'], async (req, res) => {
  try {
    await articlesHandler(req, res);
  } catch (err: any) {
    console.error('Express /api/articles route error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err?.message || 'Internal Server Error' });
    }
  }
});

// Підключення API ендпоінту налаштувань сайту (включаючи соц. мережі)
app.all(['/api/settings', '/api/settings/'], async (req, res) => {
  try {
    await settingsHandler(req, res);
  } catch (err: any) {
    console.error('Express /api/settings route error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err?.message || 'Internal Server Error' });
    }
  }
});

// Обробка помилок парсингу JSON
app.use((err: any, _req: any, res: any, next: any) => {
  if (err) {
    console.error('Express body parser error:', err);
    return res.status(400).json({ error: err?.message || 'Invalid request body' });
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
