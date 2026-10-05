import { Article, SiteSocialLinks } from '../types';
import { getAuthHeaders } from './auth';

// Безпечний клієнт: усі запити проходять через захищений серверний API (/api/*),
// жодні ключі або реквізити бази даних ніколи не передаються в браузер клієнта.

export async function fetchSocialLinksFromCloud(): Promise<SiteSocialLinks | null> {
  try {
    const res = await fetch(`/api/settings?_t=${Date.now()}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      return data as SiteSocialLinks;
    }
  } catch (err) {
    console.warn('API fetchSocialLinks notice:', err);
  }
  return null;
}

export async function saveSocialLinksToCloud(links: SiteSocialLinks): Promise<SiteSocialLinks> {
  const res = await fetch(`/api/settings?_t=${Date.now()}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(links),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Помилка збереження налаштувань на сервері');
  }

  const saved = await res.json();
  return saved;
}

export async function fetchArticlesFromCloud(): Promise<Article[] | null> {
  try {
    const res = await fetch(`/api/articles?_t=${Date.now()}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        return data as Article[];
      }
    }
  } catch (err) {
    console.warn('API fetchArticles notice:', err);
  }
  return null;
}

export async function saveArticleToCloud(article: Article): Promise<Article> {
  const res = await fetch(`/api/articles?_t=${Date.now()}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(article),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Помилка збереження статті на сервері');
  }

  const saved = await res.json();
  return saved;
}

export async function deleteArticleFromCloud(id: string): Promise<boolean> {
  const res = await fetch(`/api/articles?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Помилка видалення статті на сервері');
  }

  return true;
}
