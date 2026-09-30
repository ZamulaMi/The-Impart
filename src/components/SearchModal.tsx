import React, { useState, useEffect, useRef } from 'react';
import { Search, X, ArrowRight } from 'lucide-react';
import { Article, SiteLanguage } from '../types';
import { formatTimeAgoOrDate } from '../utils/date';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  articles: Article[];
  lang: SiteLanguage;
  onSelectArticle: (id: string) => void;
  onShowAllSearchResults: (query: string, results: Article[]) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  articles,
  lang,
  onSelectArticle,
  onShowAllSearchResults,
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isEn = lang === 'en';
  const cleanQuery = query.trim().toLowerCase();

  // Фільтруємо статті за активною мовою та релевантністю
  const matchingArticles = articles.filter((article) => {
    // Перевірка видимості
    if (isEn) {
      const isPubEn = article.publishedEn === true || String(article.publishedEn) === 'true';
      if (!isPubEn || !article.titleEn?.trim()) return false;
    } else {
      const isPub = article.published === true || String(article.published) === 'true' || (article.published as any) === 1;
      if (!isPub) return false;
    }

    if (!cleanQuery) return false;

    // Поля для поточної мови
    const title = (isEn ? article.titleEn : article.title) || '';
    const excerpt = (isEn ? article.excerptEn : article.excerpt) || '';
    const content = (isEn ? article.contentEn : article.content) || '';
    const category = (isEn ? (article.categoryEn || article.category) : article.category) || '';

    return (
      title.toLowerCase().includes(cleanQuery) ||
      excerpt.toLowerCase().includes(cleanQuery) ||
      content.toLowerCase().includes(cleanQuery) ||
      category.toLowerCase().includes(cleanQuery)
    );
  });

  const handleOpenAll = () => {
    if (matchingArticles.length > 0) {
      onShowAllSearchResults(cleanQuery, matchingArticles);
      onClose();
    }
  };

  const handleItemClick = (id: string) => {
    onSelectArticle(id);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex flex-col items-center justify-start bg-white/80 backdrop-blur-md transition-all duration-300 px-4 sm:px-8 pt-16 sm:pt-24 pb-8 overflow-y-auto"
    >
      {/* Кнопка закриття у верхньому правому кутку */}
      <button
        onClick={onClose}
        aria-label="Закрити пошук"
        className="fixed top-6 right-6 sm:right-12 p-2.5 text-neutral-400 hover:text-black hover:rotate-90 transition-all duration-300 cursor-pointer rounded-full hover:bg-neutral-100"
      >
        <X className="w-6 h-6 stroke-[1.5]" />
      </button>

      {/* Центральний контейнер пошуку */}
      <div className="w-full max-w-2xl mx-auto flex flex-col items-center">
        {/* Поле вводу по центру */}
        <div className="w-full relative flex items-center border-b-2 border-neutral-900 pb-3 transition-colors">
          <Search className="w-6 h-6 text-neutral-400 mr-3.5 shrink-0 stroke-[1.75]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && matchingArticles.length > 0) {
                handleOpenAll();
              }
            }}
            placeholder={isEn ? 'Search articles, thoughts, topics...' : 'Пошук за назвою, описом або текстом...'}
            className="w-full text-xl sm:text-2xl md:text-3xl font-serif text-black placeholder:text-neutral-300 placeholder:font-serif focus:outline-none bg-transparent leading-relaxed"
          />
          {query && (
            <button
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="text-xs uppercase tracking-wider text-neutral-400 hover:text-black px-2 py-1 cursor-pointer transition-colors"
            >
              {isEn ? 'Clear' : 'Очистити'}
            </button>
          )}
        </div>

        {/* Підказка під полем вводу */}
        {!cleanQuery && (
          <p className="text-xs sm:text-sm text-neutral-400 mt-4 font-sans tracking-wide text-center">
            {isEn
              ? 'Start typing keywords to search by title, excerpt, and content.'
              : 'Введіть ключові слова для миттєвого пошуку за заголовком, описом або текстом статей.'}
          </p>
        )}

        {/* Результати пошуку */}
        {cleanQuery && (
          <div className="w-full mt-8 space-y-3 animate-fade-in">
            {/* Панель з кількістю та кнопкою "Відкрити всі результати" */}
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <span className="text-xs uppercase tracking-wider text-neutral-500 font-sans">
                {isEn
                  ? `Found ${matchingArticles.length} ${matchingArticles.length === 1 ? 'article' : 'articles'}`
                  : `Знайдено матеріалів: ${matchingArticles.length}`}
              </span>

              {matchingArticles.length > 0 && (
                <button
                  onClick={handleOpenAll}
                  className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider font-medium text-black hover:text-neutral-600 transition-colors cursor-pointer group"
                >
                  <span>{isEn ? 'View all results on main' : 'Відкрити всі знайдені статті'}</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </button>
              )}
            </div>

            {/* Список знайдених статей */}
            {matchingArticles.length > 0 ? (
              <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
                {matchingArticles.map((article) => {
                  const title = isEn && article.titleEn ? article.titleEn : article.title;
                  const excerpt = isEn && article.excerptEn ? article.excerptEn : article.excerpt;
                  const category = isEn && article.categoryEn ? article.categoryEn : article.category;
                  const timeAgo = formatTimeAgoOrDate(article.createdAt, article.date, article.id, lang);

                  return (
                    <div
                      key={article.id}
                      onClick={() => handleItemClick(article.id)}
                      className="group cursor-pointer p-4 rounded-lg border border-neutral-100 hover:border-black/30 hover:bg-neutral-50/80 transition-all duration-200 flex items-center justify-between gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-neutral-400 mb-1">
                          <span className="font-medium text-neutral-700">{category}</span>
                          <span>•</span>
                          <span>{timeAgo}</span>
                        </div>
                        <h4
                          className="text-base sm:text-lg font-serif font-medium text-black group-hover:text-neutral-600 transition-colors line-clamp-1"
                          style={{ fontFamily: "'Playfair Display', serif" }}
                        >
                          {title}
                        </h4>
                        {excerpt && (
                          <p className="text-xs text-neutral-500 line-clamp-1 mt-1 font-sans">
                            {excerpt}
                          </p>
                        )}
                      </div>

                      {article.coverImage && (
                        <div className="w-16 h-12 sm:w-20 sm:h-14 shrink-0 rounded overflow-hidden bg-neutral-100 shadow-xs">
                          <img
                            src={article.coverImage}
                            alt=""
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center">
                <p className="text-neutral-400 font-serif italic text-base sm:text-lg">
                  {isEn ? 'No articles match your query.' : 'За вашим запитом нічого не знайдено.'}
                </p>
                <p className="text-xs text-neutral-400 mt-1">
                  {isEn ? 'Try another keyword or check spelling.' : 'Спробуйте використати інші ключові слова.'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
