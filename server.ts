import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import articlesHandler from './api/articles';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Підключення API ендпоінту статей
app.all('/api/articles', async (req, res) => {
  await articlesHandler(req, res);
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
