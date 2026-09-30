import React from 'react';
import { ArrowLeft, EyeOff, Globe } from 'lucide-react';
import { Article, SiteLanguage } from '../types';
import { formatTimeAgoOrDate } from '../utils/date';
import { ContentRenderer } from './ContentRenderer';

interface ArticleViewProps {
  article: Article;
  lang: SiteLanguage;
  onBack: () => void;
  onSwitchLang?: (lang: SiteLanguage) => void;
}

export const ArticleView: React.FC<ArticleViewProps> = ({
  article,
  lang,
  onBack,
  onSwitchLang,
}) => {
  const isEn = lang === 'en';
  const hasEnVersion = Boolean(article.titleEn?.trim() && article.contentEn?.trim());

  // Вибір даних залежно від обраної мови
  const title = isEn && hasEnVersion ? article.titleEn! : article.title;
  const content = isEn && hasEnVersion ? article.contentEn! : article.content;
  const excerpt = isEn && hasEnVersion ? article.excerptEn : article.excerpt;
  const category = isEn && hasEnVersion ? article.categoryEn || article.category : article.category;

  const isHidden = isEn
    ? article.publishedEn === false || !article.publishedEn
    : article.published === false || String(article.published) === 'false';

  const timeDisplay = formatTimeAgoOrDate(article.createdAt, article.date, article.id, lang);

  return (
    <article className="max-w-3xl mx-auto px-6 sm:px-12 py-10 sm:py-16">
      {/* Верхня навігація та індикатор прихованості */}
      <div className="flex items-center justify-between mb-8 sm:mb-10">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-neutral-500 hover:text-black transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
          <span>{isEn ? 'All articles' : 'Усі статті'}</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Якщо користувач перемкнувся на англійську, але стаття ще не перекладена */}
          {isEn && !hasEnVersion && (
            <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-2.5 py-1 rounded">
              <Globe className="w-3.5 h-3.5" />
              <span>English version coming soon (showing UA)</span>
            </span>
          )}

          {isHidden && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600 bg-neutral-100 px-3 py-1 rounded">
              <EyeOff className="w-3.5 h-3.5 text-neutral-500" />
              <span>
                {isEn ? 'Draft preview' : 'Прихована стаття (попередній перегляд)'}
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Рубрика та час публікації */}
      <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-neutral-500 mb-4">
        <span>{category}</span>
        {timeDisplay && (
          <>
            <span className="text-neutral-300">•</span>
            <span>{timeDisplay}</span>
          </>
        )}
      </div>

      {/* Заголовок */}
      <h1
        className="text-3xl sm:text-4xl md:text-5xl font-medium tracking-tight text-black leading-tight mb-6"
        style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
      >
        {title}
      </h1>

      {/* Автор та дата */}
      <div className="flex items-center justify-between py-4 border-y border-neutral-100 mb-8 text-xs text-neutral-500">
        <span>{article.author}</span>
        <span>{timeDisplay}</span>
      </div>

      {/* Обкладинка статті */}
      {article.coverImage && (
        <div className="mb-10 aspect-[16/9] w-full overflow-hidden bg-neutral-100 rounded-lg">
          <img
            src={article.coverImage}
            alt={title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Лід / короткий опис */}
      {excerpt && (
        <p className="text-lg sm:text-xl text-neutral-700 leading-relaxed font-serif italic mb-8 border-l-2 border-black pl-6">
          {excerpt}
        </p>
      )}

      {/* Рендеринг тексту з медіа */}
      <div className="prose prose-neutral max-w-none text-base sm:text-lg leading-relaxed text-neutral-800">
        <ContentRenderer content={content} />
      </div>
    </article>
  );
};
