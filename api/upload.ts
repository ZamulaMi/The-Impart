import { verifyAdminToken, extractToken } from './auth';

export default async function handler(req: any, res: any) {
  // Налаштування CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. Перевірка авторизації адміністратора
    const token = extractToken(req);
    if (!verifyAdminToken(token)) {
      return res.status(401).json({ error: 'Потрібна авторизація адміністратора для завантаження медіа' });
    }

    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({ error: 'Недійсний JSON' });
      }
    }

    if (!body || typeof body !== 'object') {
      if (typeof req.on === 'function' && !req.readableEnded && req.readable) {
        body = await new Promise((resolve) => {
          let data = '';
          req.on('data', (chunk: any) => { data += chunk; });
          req.on('end', () => {
            try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); }
          });
          req.on('error', () => resolve({}));
        });
      }
    }

    const { data } = body || {};
    if (!data || typeof data !== 'string') {
      return res.status(400).json({ error: 'Зображення не передано' });
    }

    // Якщо це зовнішній URL або Data URL
    if (data.startsWith('http://') || data.startsWith('https://')) {
      return res.status(200).json({ url: data });
    }

    const matches = data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: 'Недійсний формат зображення (очікується Base64 або URL)' });
    }

    const mimeType = matches[1].toLowerCase();
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
    if (!allowedMimes.includes(mimeType)) {
      return res.status(400).json({ error: 'Дозволені лише формати зображень: JPEG, PNG, WebP, GIF, SVG' });
    }

    // У середовищі Vercel Serverless (read-only filesystem) повертаємо оптимізований Data URL
    return res.status(200).json({
      url: data,
      success: true,
    });
  } catch (err: any) {
    console.error('API /api/upload error:', err);
    return res.status(500).json({ error: 'Помилка сервера завантаження' });
  }
}
