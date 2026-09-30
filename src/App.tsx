/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { Article, SiteLanguage } from './types';
import { AdminPanel } from './components/AdminPanel';
import { ArticleView } from './components/ArticleView';
import { formatTimeAgoOrDate } from './utils/date';

const STORAGE_KEY = 'the_impart_articles_v1';
const LANG_STORAGE_KEY = 'the_impart_lang_v1';

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

  const [siteLang, setSiteLang] = useState<SiteLanguage>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(LANG_STORAGE_KEY);
      if (saved === 'en' || saved === 'ua') return saved;
    }
    return 'ua';
  });

  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const handleSetLang = (lang: SiteLanguage) => {
    setSiteLang(lang);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchArticlesFromDb = async () => {
    try {
      const res = await fetch('/api/articles');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setArticles(data);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
          } catch (e) {
            console.error(e);
          }
        }
      }
    } catch (err) {
      console.warn('Backend unavailable, checking local storage:', err);
      try {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached) {
          setArticles(JSON.parse(cached));
        }
      } catch (e) {
        console.error(e);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Завантаження статей виключно із бази даних
  useEffect(() => {
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
        fetchArticlesFromDb();
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
    // Збереження у базу даних Neon Postgres
    const res = await fetch('/api/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(article),
    });

    if (!res.ok) {
      let errorDetail = `Помилка сервера HTTP ${res.status}`;
      try {
        const err = await res.json();
        if (err && err.error) {
          errorDetail = err.error;
        }
      } catch {
        const text = await res.text().catch(() => '');
        if (text && text.length < 200) {
          errorDetail = text;
        }
      }
      throw new Error(errorDetail);
    }

    const savedArticle = await res.json();

    // Оновлюємо стан на основі відповіді бази даних
    setArticles((prev) => {
      const exists = prev.some((a) => a.id === savedArticle.id);
      const updated = exists
        ? prev.map((a) => (a.id === savedArticle.id ? savedArticle : a))
        : [savedArticle, ...prev];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });

    await fetchArticlesFromDb();
  };

  const handleDeleteArticle = async (id: string) => {
    try {
      const res = await fetch(`/api/articles?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
    } catch (e) {
      console.error('Failed to delete article from database:', e);
    }

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
  };

  // Режим адмін-панелі
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

  // Фільтрація статей відповідно до обраної мови
  const publishedArticles = articles.filter((a) => {
    if (siteLang === 'en') {
      const isPubEn = a.publishedEn === true || String(a.publishedEn) === 'true';
      return isPubEn && Boolean(a.titleEn?.trim());
    }
    return a.published === true || String(a.published) === 'true' || (a.published as any) === 1;
  });

  const selectedArticle = articles.find((a) => a.id === selectedArticleId);

  return (
    <div className="min-h-screen w-full bg-white text-black flex flex-col justify-between">
      {/* Шапка (Header) - повернено чистий початковий вигляд без перемикача */}
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
              lang={siteLang}
              onBack={() => setSelectedArticleId(null)}
              onSwitchLang={handleSetLang}
            />
          ) : (
            <div className="max-w-6xl mx-auto px-6 sm:px-12 md:px-16 py-8 sm:py-12">
              {isLoading ? (
                <div className="py-24 text-center">
                  <div className="inline-block w-5 h-5 border-2 border-neutral-300 border-t-black rounded-full animate-spin" />
                </div>
              ) : publishedArticles.length === 0 ? (
                <div className="py-24 text-center max-w-md mx-auto">
                  <p className="text-neutral-400 font-serif italic text-lg sm:text-xl mb-2">
                    {siteLang === 'en'
                      ? 'No articles published in English yet.'
                      : 'У базі даних наразі немає опублікованих статей.'}
                  </p>
                  <p className="text-xs text-neutral-400 font-sans">
                    {siteLang === 'en' ? (
                      <button
                        onClick={() => handleSetLang('ua')}
                        className="text-black underline underline-offset-4 cursor-pointer hover:opacity-75"
                      >
                        Switch to Ukrainian version to read materials.
                      </button>
                    ) : (
                      'Створюйте та публікуйте матеріали через панель адміністратора.'
                    )}
                  </p>
                </div>
              ) : (
                <div className="space-y-16">
                  {/* Головна стаття (перша у списку) */}
                  {publishedArticles[0] && (() => {
                    const hero = publishedArticles[0];
                    const isEn = siteLang === 'en';
                    const title = isEn && hero.titleEn ? hero.titleEn : hero.title;
                    const excerpt = isEn && hero.excerptEn ? hero.excerptEn : hero.excerpt;
                    const category = isEn && hero.categoryEn ? hero.categoryEn : hero.category;
                    const timeAgo = formatTimeAgoOrDate(hero.createdAt, hero.date, hero.id, siteLang);

                    return (
                      <article
                        onClick={() => {
                          setSelectedArticleId(hero.id);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="group cursor-pointer grid grid-cols-1 lg:grid-cols-12 gap-8 items-center border-b border-neutral-100 pb-16"
                      >
                        {hero.coverImage && (
                          <div className="lg:col-span-7 aspect-[16/10] overflow-hidden bg-neutral-100 rounded-lg">
                            <img
                              src={hero.coverImage}
                              alt={title}
                              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                            />
                          </div>
                        )}
                        <div className={hero.coverImage ? 'lg:col-span-5' : 'lg:col-span-12'}>
                          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-neutral-400 mb-3">
                            <span>{category}</span>
                            <span>•</span>
                            <span>{timeAgo}</span>
                          </div>
                          <h2
                            className="text-2xl sm:text-3xl lg:text-4xl font-serif font-medium text-black group-hover:text-neutral-600 transition-colors leading-snug mb-4"
                            style={{ fontFamily: "'Playfair Display', serif" }}
                          >
                            {title}
                          </h2>
                          {excerpt && (
                            <p className="text-sm sm:text-base text-neutral-600 leading-relaxed font-sans mb-5 line-clamp-3">
                              {excerpt}
                            </p>
                          )}
                          <div className="text-xs text-neutral-400">
                            {hero.author}
                          </div>
                        </div>
                      </article>
                    );
                  })()}

                  {/* Сітка наступних статей */}
                  {publishedArticles.length > 1 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                      {publishedArticles.slice(1).map((article) => {
                        const isEn = siteLang === 'en';
                        const title = isEn && article.titleEn ? article.titleEn : article.title;
                        const excerpt = isEn && article.excerptEn ? article.excerptEn : article.excerpt;
                        const category = isEn && article.categoryEn ? article.categoryEn : article.category;
                        const timeAgo = formatTimeAgoOrDate(article.createdAt, article.date, article.id, siteLang);

                        return (
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
                                <div className="aspect-[16/10] mb-5 overflow-hidden bg-neutral-100 rounded-lg">
                                  <img
                                    src={article.coverImage}
                                    alt={title}
                                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                                  />
                                </div>
                              )}
                              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-neutral-400 mb-2">
                                <span>{category}</span>
                                <span>•</span>
                                <span>{timeAgo}</span>
                              </div>
                              <h3
                                className="text-lg sm:text-xl font-serif font-medium text-black group-hover:text-neutral-600 transition-colors leading-snug mb-2"
                                style={{ fontFamily: "'Playfair Display', serif" }}
                              >
                                {title}
                              </h3>
                              {excerpt && (
                                <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed font-sans line-clamp-2 mb-3">
                                  {excerpt}
                                </p>
                              )}
                            </div>
                            <div className="text-[11px] text-neutral-400 pt-3 border-t border-neutral-100">
                              {article.author}
                            </div>
                          </article>
                        );
                      })}
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
      <footer className="w-full bg-white px-6 sm:px-12 md:px-16 py-10 sm:py-12 border-t border-neutral-100">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div className="flex flex-col items-start">
            <span className="text-base sm:text-lg font-normal tracking-normal text-black font-sans select-none">
              The Impart
            </span>
            <p className="text-xs text-neutral-400 mt-1">
              {siteLang === 'en'
                ? 'Journal of aesthetics, philosophy, and mindful reflection.'
                : 'Журнал естетики, філософії та усвідомленого споглядання.'}
            </p>

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
            </div>
          </div>

          {/* Права частина футера: Перемикач мови UA / EN та копірайт */}
          <div className="flex flex-col sm:items-end gap-3">
            <div className="flex items-center text-xs tracking-wider font-sans select-none">
              <button
                type="button"
                onClick={() => handleSetLang('ua')}
                className={`py-1 transition-colors cursor-pointer ${
                  siteLang === 'ua'
                    ? 'font-medium text-black'
                    : 'text-neutral-400 hover:text-black'
                }`}
                title="Українська версія"
              >
                UA
              </button>
              <span className="mx-2 text-neutral-300">/</span>
              <button
                type="button"
                onClick={() => handleSetLang('en')}
                className={`py-1 transition-colors cursor-pointer ${
                  siteLang === 'en'
                    ? 'font-medium text-black'
                    : 'text-neutral-400 hover:text-black'
                }`}
                title="English version"
              >
                EN
              </button>
            </div>

            <span className="text-xs text-neutral-400 font-sans">
              © {new Date().getFullYear()} The Impart. All rights reserved.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
