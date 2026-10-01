/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { Article, SiteLanguage, SiteSocialLinks } from './types';
import { AdminPanel } from './components/AdminPanel';
import { ArticleView } from './components/ArticleView';
import { SearchModal } from './components/SearchModal';
import { formatTimeAgoOrDate } from './utils/date';

const STORAGE_KEY = 'the_impart_articles_v1';
const LANG_STORAGE_KEY = 'the_impart_lang_v1';
const SOCIAL_STORAGE_KEY = 'the_impart_social_links_v1';

const DEFAULT_SOCIAL_LINKS: SiteSocialLinks = {
  ua: {
    telegram: 'https://t.me',
    instagram: 'https://instagram.com',
    x: 'https://x.com',
    youtube: 'https://youtube.com',
    threads: 'https://threads.net',
  },
  en: {
    telegram: 'https://t.me',
    instagram: 'https://instagram.com',
    x: 'https://x.com',
    youtube: 'https://youtube.com',
    threads: 'https://threads.net',
  },
};

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

  const [socialLinks, setSocialLinks] = useState<SiteSocialLinks>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(SOCIAL_STORAGE_KEY);
        if (saved) return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return DEFAULT_SOCIAL_LINKS;
  });

  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Стан пошуку
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [activeSearchFilter, setActiveSearchFilter] = useState<{
    query: string;
    articleIds: string[];
  } | null>(null);

  const handleSetLang = (lang: SiteLanguage) => {
    setSiteLang(lang);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSocialLinksFromDb = async () => {
    try {
      const res = await fetch(`/api/settings?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === 'object') {
          setSocialLinks(data);
          try {
            localStorage.setItem(SOCIAL_STORAGE_KEY, JSON.stringify(data));
          } catch (e) {
            console.error(e);
          }
        }
      }
    } catch (err) {
      console.warn('Settings endpoint unavailable, keeping existing:', err);
    }
  };

  const handleSaveSocialLinks = async (links: SiteSocialLinks) => {
    // Миттєво зберігаємо локально
    setSocialLinks(links);
    try {
      localStorage.setItem(SOCIAL_STORAGE_KEY, JSON.stringify(links));
    } catch (e) {
      console.error(e);
    }

    try {
      const res = await fetch(`/api/settings?_t=${Date.now()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(links),
      });

      if (res.ok) {
        const saved = await res.json().catch(() => links);
        if (saved && typeof saved === 'object') {
          setSocialLinks(saved);
          try {
            localStorage.setItem(SOCIAL_STORAGE_KEY, JSON.stringify(saved));
          } catch (e) {
            console.error(e);
          }
        }
      } else {
        console.warn(`Server responded with HTTP ${res.status} for /api/settings, local save maintained.`);
      }
    } catch (err: any) {
      console.warn('Background sync error for social links, saved locally:', err);
    }
  };

  const fetchArticlesFromDb = async () => {
    try {
      const res = await fetch(`/api/articles?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
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

  // Завантаження статей та налаштувань із бази даних
  useEffect(() => {
    fetchArticlesFromDb();
    fetchSocialLinksFromDb();
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
        fetchSocialLinksFromDb();
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
    // 1. Оновлюємо стан одразу локально
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

    // 2. Синхронізуємо зі сервером
    try {
      const res = await fetch(`/api/articles?_t=${Date.now()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(article),
      });

      if (res.ok) {
        const savedArticle = await res.json().catch(() => article);
        if (savedArticle && savedArticle.id) {
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
        }
      } else {
        console.warn(`Server responded with HTTP ${res.status} for /api/articles, article saved locally.`);
      }
    } catch (err) {
      console.warn('Background sync error for article, saved locally:', err);
    }
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
        socialLinks={socialLinks}
        onSaveSocialLinks={handleSaveSocialLinks}
        onRefreshSocialLinks={fetchSocialLinksFromDb}
      />
    );
  }

  // Фільтрація статей відповідно до обраної мови
  const basePublishedArticles = articles.filter((a) => {
    if (siteLang === 'en') {
      const isPubEn = a.publishedEn === true || String(a.publishedEn) === 'true';
      return isPubEn && Boolean(a.titleEn?.trim());
    }
    return a.published === true || String(a.published) === 'true' || (a.published as any) === 1;
  });

  // Враховуємо активний фільтр пошуку (якщо користувач обрав "відкрити всі знайдені статті")
  const publishedArticles = activeSearchFilter
    ? basePublishedArticles.filter((a) => activeSearchFilter.articleIds.includes(a.id))
    : basePublishedArticles;

  const selectedArticle = articles.find((a) => a.id === selectedArticleId);

  return (
    <div className="min-h-screen w-full bg-white text-black flex flex-col justify-between">
      {/* Модальне вікно пошуку з напівпрозорим бекдропом і блюром */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        articles={articles}
        lang={siteLang}
        onSelectArticle={(id) => {
          setSelectedArticleId(id);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onShowAllSearchResults={(query, results) => {
          setSelectedArticleId(null);
          setActiveSearchFilter({
            query,
            articleIds: results.map((r) => r.id),
          });
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      {/* Шапка (Header) - мінімалістична та чиста, дизайн кнопки пошуку збережено */}
      <header className="w-full bg-white px-6 sm:px-12 md:px-16 py-6 sm:py-8 flex items-center justify-between">
        {/* Контейнер з overflow-hidden створює невидиму межу пустоти, з якої плавно виїжджає назва */}
        <div className="overflow-hidden py-1 -my-1">
          <button
            type="button"
            onClick={() => {
              navigateTo('main');
              setActiveSearchFilter(null);
            }}
            aria-label="The Impart — Головна сторінка"
            className="animate-title-slide-down block text-2xl sm:text-3xl font-medium tracking-tight text-black hover:opacity-75 transition-opacity select-none text-left cursor-pointer focus:outline-none"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            The Impart
          </button>
        </div>

        <button
          type="button"
          onClick={() => setIsSearchOpen(true)}
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
              {/* Індикатор активного фільтра пошуку на головній */}
              {activeSearchFilter && (
                <div className="mb-8 flex items-center justify-between bg-neutral-50 border border-neutral-200/80 px-4 py-3 rounded-lg animate-fade-in">
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-neutral-600">
                    <Search className="w-4 h-4 text-neutral-400 shrink-0" />
                    <span>
                      {siteLang === 'en' ? 'Results for query:' : 'Результати за запитом:'}{' '}
                      <strong className="text-black font-semibold">«{activeSearchFilter.query}»</strong>
                    </span>
                    <span className="text-neutral-400">({publishedArticles.length})</span>
                  </div>

                  <button
                    onClick={() => setActiveSearchFilter(null)}
                    className="text-xs uppercase tracking-wider text-neutral-500 hover:text-black flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <span>{siteLang === 'en' ? 'Reset search' : 'Скинути пошук'}</span>
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {isLoading ? (
                <div className="py-24 text-center">
                  <div className="inline-block w-5 h-5 border-2 border-neutral-300 border-t-black rounded-full animate-spin" />
                </div>
              ) : publishedArticles.length === 0 ? (
                <div className="py-24 text-center max-w-md mx-auto">
                  <p className="text-neutral-400 font-serif italic text-lg sm:text-xl mb-2">
                    {activeSearchFilter
                      ? siteLang === 'en'
                        ? 'No articles match your search criteria.'
                        : 'За вашим запитом не знайдено опублікованих статей.'
                      : siteLang === 'en'
                      ? 'No articles published in English yet.'
                      : 'У базі даних наразі немає опублікованих статей.'}
                  </p>
                  <p className="text-xs text-neutral-400 font-sans">
                    {activeSearchFilter ? (
                      <button
                        onClick={() => setActiveSearchFilter(null)}
                        className="text-black underline underline-offset-4 cursor-pointer hover:opacity-75"
                      >
                        {siteLang === 'en' ? 'Show all articles' : 'Показати всі матеріали'}
                      </button>
                    ) : siteLang === 'en' ? (
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
                <div className="space-y-4 sm:space-y-5">
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
                        className="group relative cursor-pointer overflow-hidden rounded-xl bg-neutral-900 shadow-md hover:shadow-xl transition-all duration-500 min-h-[380px] sm:min-h-[460px] md:min-h-[520px] flex flex-col justify-end"
                      >
                        {/* Фонове фото */}
                        {hero.coverImage ? (
                          <img
                            src={hero.coverImage}
                            alt={title}
                            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                          />
                        ) : (
                          <div className="absolute inset-0 bg-neutral-900" />
                        )}

                        {/* Темні градієнтні накладки для максимальної читабельності */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/15 group-hover:from-black/90 group-hover:via-black/50 transition-all duration-300" />

                        {/* Контент статті прямо на фото */}
                        <div className="relative z-10 p-6 sm:p-10 md:p-12 text-white max-w-3xl">
                          {/* Рубрика та динамічний час на фото */}
                          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/80 mb-3 drop-shadow-xs">
                            <span className="font-medium text-white/95">{category}</span>
                            <span className="text-white/40">•</span>
                            <span className="text-white/80">{timeAgo}</span>
                          </div>

                          {/* Назва статті на фото */}
                          <h2
                            className="text-2xl sm:text-3xl lg:text-4xl font-serif font-medium text-white leading-snug drop-shadow-sm group-hover:text-white/95 transition-colors"
                            style={{ fontFamily: "'Playfair Display', serif" }}
                          >
                            {title}
                          </h2>

                          {/* Короткий опис: плавно з'являється при наведенні курсору */}
                          {excerpt && (
                            <div className="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] transition-all duration-300 ease-out">
                              <div className="overflow-hidden">
                                <p className="text-sm sm:text-base text-neutral-200 leading-relaxed font-sans pt-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-75 line-clamp-3">
                                  {excerpt}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })()}

                  {/* Сітка наступних статей: назва, рубрика і час на фото, опис при наведенні */}
                  {publishedArticles.length > 1 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4 lg:gap-5">
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
                            className="group relative cursor-pointer overflow-hidden rounded-xl bg-neutral-900 shadow-md hover:shadow-lg transition-all duration-500 aspect-[4/5] sm:aspect-[3/4] flex flex-col justify-end"
                          >
                            {/* Фонове фото */}
                            {article.coverImage ? (
                              <img
                                src={article.coverImage}
                                alt={title}
                                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                              />
                            ) : (
                              <div className="absolute inset-0 bg-neutral-900 flex items-center justify-center text-white/30 font-serif text-sm">
                                The Impart
                              </div>
                            )}

                            {/* Градієнтна накладка для тексту */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/15 group-hover:from-black/90 group-hover:via-black/50 transition-all duration-300" />

                            {/* Контент поверх фото */}
                            <div className="relative z-10 p-5 sm:p-6 text-white w-full">
                              {/* Рубрика та динамічний час */}
                              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-white/80 mb-2 drop-shadow-xs">
                                <span className="font-medium text-white/95">{category}</span>
                                <span className="text-white/40">•</span>
                                <span className="text-white/80">{timeAgo}</span>
                              </div>

                              {/* Назва статті на фото */}
                              <h3
                                className="text-lg sm:text-xl font-serif font-medium text-white leading-snug drop-shadow-sm group-hover:text-white/95 transition-colors line-clamp-3"
                                style={{ fontFamily: "'Playfair Display', serif" }}
                              >
                                {title}
                              </h3>

                              {/* Короткий опис: з'являється при наведенні курсору */}
                              {excerpt && (
                                <div className="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] transition-all duration-300 ease-out">
                                  <div className="overflow-hidden">
                                    <p className="text-xs sm:text-sm text-neutral-200 leading-relaxed font-sans pt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-75 line-clamp-3">
                                      {excerpt}
                                    </p>
                                  </div>
                                </div>
                              )}
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
              {socialLinks[siteLang]?.telegram && (
                <a
                  href={socialLinks[siteLang].telegram}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Telegram"
                  className="text-neutral-600 hover:text-black transition-colors"
                >
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M21.927 3.513a1.498 1.498 0 0 0-1.505-.288L2.348 10.38c-1.048.423-1.042 1.34-.191 1.602l4.639 1.448 10.741-6.777c.507-.308.972-.143.59.196l-8.704 7.854-.319 4.768c.467 0 .673-.214.935-.467l2.247-2.185 4.675 3.453c.861.475 1.482.23 1.696-.8l3.068-14.457c.314-1.26-.481-1.831-1.308-1.442z" />
                  </svg>
                </a>
              )}

              {/* Instagram */}
              {socialLinks[siteLang]?.instagram && (
                <a
                  href={socialLinks[siteLang].instagram}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Instagram"
                  className="text-neutral-600 hover:text-black transition-colors"
                >
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                </a>
              )}

              {/* X (formerly Twitter) */}
              {socialLinks[siteLang]?.x && (
                <a
                  href={socialLinks[siteLang].x}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="X (Twitter)"
                  className="text-neutral-600 hover:text-black transition-colors"
                >
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
              )}

              {/* YouTube */}
              {socialLinks[siteLang]?.youtube && (
                <a
                  href={socialLinks[siteLang].youtube}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="YouTube"
                  className="text-neutral-600 hover:text-black transition-colors"
                >
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                  </svg>
                </a>
              )}

              {/* Threads (остання у списку з чистим мінімалістичним силуетом) */}
              {socialLinks[siteLang]?.threads && (
                <a
                  href={socialLinks[siteLang].threads}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Threads"
                  className="text-neutral-600 hover:text-black transition-colors"
                >
                  <svg className="w-5 h-5 fill-none stroke-current stroke-[1.8] stroke-linecap-round stroke-linejoin-round" viewBox="0 0 24 24">
                    <path d="M19.25 12c0 4.5-3.25 8.25-8 8.25-4.5 0-7.75-3.5-7.75-8.25S6.75 3.75 12 3.75c4.75 0 7.5 3 7.75 7.25M16 11.25c0 3-1.75 4.5-4 4.5s-3.75-1.5-3.75-3.75S9.75 8.25 12 8.25c2.75 0 4 2 4 4.5v1.25c0 1.5-.75 2.5-2 2.5s-2-.75-2-2.25" />
                  </svg>
                </a>
              )}
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
