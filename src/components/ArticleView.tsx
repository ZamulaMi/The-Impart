import React from 'react';
import { ArrowLeft, EyeOff } from 'lucide-react';
import { Article } from '../types';
import { formatTimeAgoOrDate } from '../utils/date';
import { ContentRenderer } from './ContentRenderer';

interface ArticleViewProps {
  article: Article;
  onBack: () => void;
}

export const ArticleView: React.FC<ArticleViewProps> = ({ article, onBack }) => {
  const isHidden = article.published === false || String(article.published) === 'false';
  const timeDisplay = formatTimeAgoOrDate(article.createdAt, article.date, article.id);

  return (
    <article className="max-w-3xl mx-auto px-6 sm:px-12 py-10 sm:py-16">
      <div className="flex items-center justify-between mb-10">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-neutral-500 hover:text-black transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
          <span>Усі статті</span>
        </button>

        {isHidden && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600 bg-neutral-100 px-3 py-1 rounded">
            <EyeOff className="w-3.5 h-3.5 text-neutral-500" />
            Прихована стаття (попередній перегляд)
          </span>
        )}
      </div>

      {/* Рубрика та час публікації (без часу читання) */}
      <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-neutral-500 mb-4">
        <span>{article.category}</span>
        {timeDisplay && (
          <>
            <span className="text-neutral-300">•</span>
            <span>{timeDisplay}</span>
          </>
        )}
      </div>

      <h1
        className="text-3xl sm:text-4xl md:text-5xl font-medium tracking-tight text-black leading-tight mb-6"
        style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
      >
        {article.title}
      </h1>

      <div className="flex items-center justify-between py-4 border-y border-neutral-100 mb-8 text-xs text-neutral-500">
        <span>{article.author}</span>
        <span>{timeDisplay}</span>
      </div>

      {article.coverImage && (
        <div className="mb-10 aspect-[16/9] w-full overflow-hidden bg-neutral-100 rounded-lg">
          <img
            src={article.coverImage}
            alt={article.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {article.excerpt && (
        <p className="text-lg sm:text-xl text-neutral-700 leading-relaxed font-serif italic mb-8 border-l-2 border-black pl-6">
          {article.excerpt}
        </p>
      )}

      {/* Рендеринг тексту з підтримкою посилань на фото та відео з YouTube */}
      <div className="prose prose-neutral max-w-none text-base sm:text-lg leading-relaxed text-neutral-800">
        <ContentRenderer content={article.content} />
      </div>
    </article>
  );
};
