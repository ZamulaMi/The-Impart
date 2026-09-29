import { getArticles, saveArticle, deleteArticle } from './db';

export default async function handler(req: any, res: any) {
  // Налаштування CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const articles = await getArticles();
      return res.status(200).json(articles);
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!body || !body.title) {
        return res.status(400).json({ error: 'Title is required' });
      }
      const saved = await saveArticle(body);
      return res.status(200).json(saved);
    }

    if (req.method === 'DELETE') {
      const id = req.query?.id || req.body?.id;
      if (!id) {
        return res.status(400).json({ error: 'ID is required' });
      }
      await deleteArticle(id.toString());
      return res.status(200).json({ success: true, id });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('API /api/articles error:', error);
    return res.status(500).json({ error: error?.message || 'Internal Server Error' });
  }
}
