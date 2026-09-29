/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { Article } from './types';
import { INITIAL_ARTICLES } from './data/initialArticles';
import { AdminPanel } from './components/AdminPanel';
import { ArticleView } from './components/ArticleView';

const STORAGE_KEY = 'the_impart_articles_v1';

export default function App() {
  const [currentRoute, setCurrentRoute] = useState<'main' | 'admin'>(() => {
    if (typeof window === 'undefined') return 'main';
    const path = window.location.pathname;
    const hash = window.location.hash;
    const search = window.location.search;
    return path.includes('/admin') || hash === '#admin' || search.includes('admin')
      ? 'admin'
      : 'main';
  });

  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);

  const [articles, setArticles] = useState<Article[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return INITIAL_ARTICLES;
  });

  // Завантаження статей із бази даних
  useEffect(() => {
    const fetchArticlesFromDb = async () => {
      try {
        const res = await fetch('/api/articles');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setArticles(data);
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            } catch (e) {
              console.error(e);
            }
          }
        }
      } catch (err) {
        console.warn('Backend unavailable, using cached articles:', err);
      }
    };

    fetchArticlesFromDb();
  }, []);

  // Синхронізація з навігацією браузера
  useEffect(() => {
    const handleLocationChange = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;
      const search = window.location.search;
      if (path.includes('/admin') || hash === '#admin' || search.includes('admin')) {
        setCurrentRoute('admin');
        setSelectedArticleId(null);
      } else {
        setCurrentRoute('main');
      }
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  const navigateTo = (route: 'main' | 'admin', articleId?: string) => {
    if (route === 'admin') {
      window.history.pushState(null, '', '/admin');
      setCurrentRoute('admin');
      setSelectedArticleId(null);
    } else {
      window.history.pushState(null, '', '/');
      setCurrentRoute('main');
      if (articleId) {
        setSelectedArticleId(articleId);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setSelectedArticleId(null);
      }
    }
  };

  const handleSaveArticle = async (article: Article) => {
    // Оптимістичне збереження
    setArticles((prev) => {
      const exists = prev.some((a) => a.id === article.id);
      const updated = exists
        ? prev.map((a) => (a.id === article.id ? article : a))
        : [article, ...prev];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });

    // Збереження у базу даних Vercel Postgres
    try {
      await fetch('/api/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(article),
      });
    } catch (e) {
      console.error('Failed to sync article with database:', e);
    }
  };

  const handleDeleteArticle = async (id: string) => {
    // Оптимістичне видалення
    setArticles((prev) => {
      const updated = prev.filter((a) => a.id !== id);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
    if (selectedArticleId === id) {
      setSelectedArticleId(null);
    }

    // Видалення з бази даних Vercel Postgres
    try {
      await fetch(`/api/articles?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    } catch (e) {
      console.error('Failed to delete article from database:', e);
    }
  };

  // Режим адмін-панелі (доступний тільки за посиланням)
  if (currentRoute === 'admin') {
    return (
      <AdminPanel
        articles={articles}
        onSaveArticle={handleSaveArticle}
        onDeleteArticle={handleDeleteArticle}
        onExitAdmin={() => navigateTo('main')}
        onViewArticleOnSite={(id) => navigateTo('main', id)}
      />
    );
  }

  const publishedArticles = articles.filter((a) => a.published);
  const selectedArticle = articles.find((a) => a.id === selectedArticleId);

  return (
    <div className="min-h-screen w-full bg-white text-black flex flex-col justify-between">
      {/* Шапка (Header) */}
      <header className="w-full bg-white px-6 sm:px-12 md:px-16 py-6 sm:py-8 flex items-center justify-between">
        <button
          onClick={() => setSelectedArticleId(null)}
          className="text-2xl sm:text-3xl font-medium tracking-tight text-black select-none text-left cursor-pointer focus:outline-none"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          The Impart
        </button>
        <button
          type="button"
          aria-label="Пошук"
          className="p-2 text-black hover:opacity-60 transition-opacity cursor-pointer focus:outline-none"
        >
          <Search className="w-5 h-5 stroke-[1.75]" />
        </button>
      </header>

      {/* Центральна частина (Body) зі статтями */}
      <main className="flex-1 flex flex-col justify-between">
        <div className="w-full">
          {selectedArticle ? (
            <ArticleView
              article={selectedArticle}
              onBack={() => setSelectedArticleId(null)}
            />
          ) : (
            <div className="max-w-6xl mx-auto px-6 sm:px-12 md:px-16 py-8 sm:py-12">
              {publishedArticles.length === 0 ? (
                <div className="py-24 text-center">
                  <p className="text-neutral-400 font-serif italic text-lg">
                    Матеріали готуються до публікації.
                  </p>
                </div>
              ) : (
                <div className="space-y-16">
                  {/* Головна стаття (перша у списку) */}
                  {publishedArticles[0] && (
                    <article
                      onClick={() => {
                        setSelectedArticleId(publishedArticles[0].id);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="group cursor-pointer grid grid-cols-1 lg:grid-cols-12 gap-8 items-center border-b border-neutral-100 pb-16"
                    >
                      {publishedArticles[0].coverImage && (
                        <div className="lg:col-span-7 aspect-[16/10] overflow-hidden bg-neutral-100">
                          <img
                            src={publishedArticles[0].coverImage}
                            alt={publishedArticles[0].title}
                            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                          />
                        </div>
                      )}
                      <div className={publishedArticles[0].coverImage ? 'lg:col-span-5' : 'lg:col-span-12'}>
                        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-neutral-400 mb-3">
                          <span>{publishedArticles[0].category}</span>
                          <span>•</span>
                          <span>{publishedArticles[0].readTime}</span>
                        </div>
                        <h2
                          className="text-2xl sm:text-3xl lg:text-4xl font-serif font-medium text-black group-hover:text-neutral-600 transition-colors leading-snug mb-4"
                          style={{ fontFamily: "'Playfair Display', serif" }}
                        >
                          {publishedArticles[0].title}
                        </h2>
                        {publishedArticles[0].excerpt && (
                          <p className="text-sm sm:text-base text-neutral-600 leading-relaxed font-sans mb-5 line-clamp-3">
                            {publishedArticles[0].excerpt}
                          </p>
                        )}
                        <div className="text-xs text-neutral-400">
                          {publishedArticles[0].author} — {publishedArticles[0].date}
                        </div>
                      </div>
                    </article>
                  )}

                  {/* Сітка наступних статей */}
                  {publishedArticles.length > 1 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                      {publishedArticles.slice(1).map((article) => (
                        <article
                          key={article.id}
                          onClick={() => {
                            setSelectedArticleId(article.id);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="group cursor-pointer flex flex-col justify-between"
                        >
                          <div>
                            {article.coverImage && (
                              <div className="aspect-[16/10] mb-5 overflow-hidden bg-neutral-100">
                                <img
                                  src={article.coverImage}
                                  alt={article.title}
                                  className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                                />
                              </div>
                            )}
                            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-neutral-400 mb-2">
                              <span>{article.category}</span>
                              <span>•</span>
                              <span>{article.readTime}</span>
                            </div>
                            <h3
                              className="text-lg sm:text-xl font-serif font-medium text-black group-hover:text-neutral-600 transition-colors leading-snug mb-2"
                              style={{ fontFamily: "'Playfair Display', serif" }}
                            >
                              {article.title}
                            </h3>
                            {article.excerpt && (
                              <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed font-sans line-clamp-2 mb-3">
                                {article.excerpt}
                              </p>
                            )}
                          </div>
                          <div className="text-[11px] text-neutral-400 pt-3 border-t border-neutral-100">
                            {article.author} — {article.date}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Низ body з градієнтним контейнером для м'якого відділення від футера */}
        <div className="w-full h-16 sm:h-24 bg-gradient-to-b from-white to-neutral-100 mt-12" />
      </main>

      {/* Футер */}
      <footer className="w-full bg-white px-6 sm:px-12 md:px-16 py-10 sm:py-12">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div className="flex flex-col items-start">
            <span className="text-base sm:text-lg font-normal tracking-normal text-black font-sans select-none">
              The Impart
            </span>

            <div className="mt-3.5 flex items-center gap-4 text-neutral-600">
              {/* Telegram */}
              <a
                href="https://t.me"
                target="_blank"
                rel="noreferrer"
                aria-label="Telegram"
                className="text-neutral-600 hover:text-black transition-colors"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M21.927 3.513a1.498 1.498 0 0 0-1.505-.288L2.348 10.38c-1.048.423-1.042 1.34-.191 1.602l4.639 1.448 10.741-6.777c.507-.308.972-.143.59.196l-8.704 7.854-.319 4.768c.467 0 .673-.214.935-.467l2.247-2.185 4.675 3.453c.861.475 1.482.23 1.696-.8l3.068-14.457c.314-1.26-.481-1.831-1.308-1.442z" />
                </svg>
              </a>

              {/* Instagram */}
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="text-neutral-600 hover:text-black transition-colors"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </a>

              {/* X (formerly Twitter) */}
              <a
                href="https://x.com"
                target="_blank"
                rel="noreferrer"
                aria-label="X (Twitter)"
                className="text-neutral-600 hover:text-black transition-colors"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>

              {/* YouTube */}
              <a
                href="https://youtube.com"
                target="_blank"
                rel="noreferrer"
                aria-label="YouTube"
                className="text-neutral-600 hover:text-black transition-colors"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </a>

              {/* Threads */}
              <a
                href="https://threads.net"
                target="_blank"
                rel="noreferrer"
                aria-label="Threads"
                className="text-neutral-600 hover:text-black transition-colors"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 192 192">
                  <path d="M141.537 88.9883C140.71 88.5919 139.87 88.2104 139.019 87.8451C137.537 60.5382 122.616 44.905 97.5619 44.745C97.4184 44.7441 97.2749 44.7441 97.1324 44.745C75.2647 44.745 57.7346 59.8336 54.3403 82.2604C53.7937 85.8677 53.5186 89.5492 53.5186 93.2687C53.5186 96.6974 53.7548 100.089 54.2217 103.407C57.4419 126.31 75.1472 142.255 97.1324 142.255C110.158 142.255 122.569 135.539 130.655 124.646C137.108 115.955 140.548 104.708 140.852 93.4116C140.916 91.0772 141.144 89.5947 141.537 88.9883ZM97.1324 127.255C82.8835 127.255 70.478 116.326 68.3242 99.4185C68.0437 97.2183 67.8997 94.9452 67.8997 92.6322C67.8997 90.5284 68.0267 88.4682 68.2748 86.4674C70.6723 70.1983 82.9733 59.745 97.1324 59.745C114.773 59.745 123.639 71.9338 124.777 92.748C117.844 89.7042 109.112 87.9712 99.4891 87.9712C81.4255 87.9712 70.6272 97.4338 70.6272 110.871C70.6272 121.72 79.508 128.854 92.0526 128.854C104.387 128.854 113.682 122.584 118.232 112.571C121.439 105.521 122.951 97.4379 123.082 89.2829C127.324 91.5323 130.551 94.671 132.378 98.4118C134.78 103.324 135.26 109.529 133.82 116.48C131.026 129.972 119.574 140.755 106.333 144.408C103.321 145.24 100.244 145.688 97.1324 145.688C69.043 145.688 45.4527 124.646 41.3496 95.8336C40.7937 91.9333 40.5186 87.9482 40.5186 83.9168C40.5186 52.3392 65.5786 26.6875 97.1324 26.6875C128.847 26.6875 153.254 52.1287 153.254 83.9168C153.254 90.9634 152.029 97.8091 149.697 104.227L163.766 109.348C166.726 101.218 168.254 92.6517 168.254 83.9168C168.254 43.8821 136.388 11.6875 97.1324 11.6875C57.4897 11.6875 25.5186 43.8821 25.5186 83.9168C25.5186 89.0478 25.8677 94.1166 26.5724 99.0768C31.7828 135.687 61.7606 160.688 97.1324 160.688C101.077 160.688 104.992 160.12 108.825 159.062C125.682 154.412 140.261 140.697 143.818 123.513C145.651 114.664 145.039 106.744 142.046 100.575C141.905 100.285 141.748 100.007 141.576 99.7409L141.537 88.9883ZM97.8105 115.854C90.7258 115.854 85.6272 111.458 85.6272 105.109C85.6272 98.7188 90.8711 94.9712 98.3752 94.9712C103.541 94.9712 108.318 95.897 112.57 97.6441C111.758 108.47 106.182 115.854 97.8105 115.854Z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Права сторона: перемикач мови */}
          <div className="flex items-center gap-1.5 text-xs sm:text-sm font-sans tracking-wide select-none">
            <span className="font-semibold text-black cursor-default">UA</span>
            <span className="text-neutral-300">/</span>
            <span className="text-neutral-400 hover:text-black transition-colors cursor-pointer">EN</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
