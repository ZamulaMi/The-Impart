import React, { useState } from 'react';
import { ArrowLeft, Plus, Trash2, Edit3, Eye, Check, ExternalLink } from 'lucide-react';
import { Article } from '../types';

interface AdminPanelProps {
  articles: Article[];
  onSaveArticle: (article: Article) => void;
  onDeleteArticle: (id: string) => void;
  onExitAdmin: () => void;
  onViewArticleOnSite: (id: string) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  articles,
  onSaveArticle,
  onDeleteArticle,
  onExitAdmin,
  onViewArticleOnSite,
}) => {
  const [editingArticle, setEditingArticle] = useState<Partial<Article> | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleStartCreate = () => {
    setIsCreatingNew(true);
    setEditingArticle({
      id: Date.now().toString(),
      title: '',
      excerpt: '',
      content: '',
      category: 'Есе',
      author: 'Редакція The Impart',
      coverImage: '',
      date: new Date().toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' }),
      readTime: '3 хв читання',
      published: true,
    });
  };

  const handleStartEdit = (article: Article) => {
    setIsCreatingNew(false);
    setEditingArticle({ ...article });
  };

  const handleCancel = () => {
    setEditingArticle(null);
    setIsCreatingNew(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingArticle || !editingArticle.title?.trim()) {
      alert('Будь ласка, вкажіть заголовок статті.');
      return;
    }

    const finalArticle: Article = {
      id: editingArticle.id || Date.now().toString(),
      title: editingArticle.title.trim(),
      excerpt: editingArticle.excerpt?.trim() || '',
      content: editingArticle.content?.trim() || '',
      category: editingArticle.category?.trim() || 'Загальне',
      author: editingArticle.author?.trim() || 'Редакція The Impart',
      coverImage: editingArticle.coverImage?.trim() || undefined,
      date: editingArticle.date || new Date().toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' }),
      readTime: editingArticle.readTime || '3 хв читання',
      published: editingArticle.published !== false,
    };

    onSaveArticle(finalArticle);
    showNotification(isCreatingNew ? 'Статтю успішно створено!' : 'Зміни успішно збережено!');
    setEditingArticle(null);
    setIsCreatingNew(false);
  };

  return (
    <div className="min-h-screen bg-white text-black font-sans flex flex-col">
      {/* Верхня панель адмінки */}
      <header className="border-b border-neutral-100 bg-white sticky top-0 z-30 px-6 sm:px-12 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={onExitAdmin}
            className="flex items-center gap-2 text-sm text-neutral-600 hover:text-black transition-colors cursor-pointer group"
            title="Повернутися на головний сайт"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span className="hidden sm:inline">На головну</span>
          </button>
          <span className="text-neutral-300">/</span>
          <span
            className="text-lg sm:text-xl font-medium tracking-tight text-black select-none"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            The Impart
          </span>
          <span className="text-[11px] uppercase tracking-wider text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-sm">
            Панель керування
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onExitAdmin}
            className="text-xs sm:text-sm text-neutral-500 hover:text-black transition-colors px-3 py-1.5 cursor-pointer flex items-center gap-1.5"
          >
            <span>Переглянути сайт</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
          {!editingArticle && (
            <button
              onClick={handleStartCreate}
              className="flex items-center gap-2 bg-black text-white px-4 py-2 text-xs sm:text-sm tracking-wide hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Нова стаття</span>
            </button>
          )}
        </div>
      </header>

      {/* Повідомлення про успіх */}
      {notification && (
        <div className="bg-neutral-900 text-white text-xs sm:text-sm py-2 px-4 text-center flex items-center justify-center gap-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{notification}</span>
        </div>
      )}

      {/* Основний вміст */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 sm:px-12 py-8 sm:py-12">
        {editingArticle ? (
          /* Форма редагування / створення статті */
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-between pb-6 border-b border-neutral-100 mb-8">
              <div>
                <h1 className="text-2xl font-serif font-medium text-black">
                  {isCreatingNew ? 'Створення нової статті' : 'Редагування статті'}
                </h1>
                <p className="text-xs text-neutral-500 mt-1">
                  Заповніть поля статті. Після збереження вона миттєво з'явиться на головному екрані сайту.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCancel}
                className="text-xs text-neutral-500 hover:text-black transition-colors"
              >
                Скасувати
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Заголовок */}
              <div>
                <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-2">
                  Заголовок статті *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Введіть заголовок статті..."
                  value={editingArticle.title || ''}
                  onChange={(e) => setEditingArticle({ ...editingArticle, title: e.target.value })}
                  className="w-full text-lg sm:text-xl font-serif border-b border-neutral-200 pb-2 focus:border-black focus:outline-none transition-colors"
                />
              </div>

              {/* Мета-дані: Рубрика, Автор, Час читання */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-2">
                    Рубрика / Тема
                  </label>
                  <input
                    type="text"
                    placeholder="напр. Філософія, Культура"
                    value={editingArticle.category || ''}
                    onChange={(e) => setEditingArticle({ ...editingArticle, category: e.target.value })}
                    className="w-full text-sm border-b border-neutral-200 pb-1.5 focus:border-black focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-2">
                    Автор
                  </label>
                  <input
                    type="text"
                    placeholder="Ім'я автора"
                    value={editingArticle.author || ''}
                    onChange={(e) => setEditingArticle({ ...editingArticle, author: e.target.value })}
                    className="w-full text-sm border-b border-neutral-200 pb-1.5 focus:border-black focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-2">
                    Час читання
                  </label>
                  <input
                    type="text"
                    placeholder="напр. 4 хв читання"
                    value={editingArticle.readTime || ''}
                    onChange={(e) => setEditingArticle({ ...editingArticle, readTime: e.target.value })}
                    className="w-full text-sm border-b border-neutral-200 pb-1.5 focus:border-black focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Зображення обкладинки */}
              <div className="pt-2">
                <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-2">
                  URL обкладинки (необов'язково)
                </label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={editingArticle.coverImage || ''}
                  onChange={(e) => setEditingArticle({ ...editingArticle, coverImage: e.target.value })}
                  className="w-full text-sm border-b border-neutral-200 pb-1.5 focus:border-black focus:outline-none transition-colors"
                />
                {editingArticle.coverImage && (
                  <div className="mt-3 aspect-[16/9] max-h-48 overflow-hidden rounded bg-neutral-50">
                    <img
                      src={editingArticle.coverImage}
                      alt="Прев'ю обкладинки"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Короткий опис / лід */}
              <div className="pt-2">
                <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-2">
                  Короткий опис (для списку на головній)
                </label>
                <textarea
                  rows={2}
                  placeholder="Одне або два речення про головну думку статті..."
                  value={editingArticle.excerpt || ''}
                  onChange={(e) => setEditingArticle({ ...editingArticle, excerpt: e.target.value })}
                  className="w-full text-sm border border-neutral-200 p-3 focus:border-black focus:outline-none transition-colors resize-none"
                />
              </div>

              {/* Повний текст статті */}
              <div className="pt-2">
                <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-2">
                  Текст статті *
                </label>
                <textarea
                  rows={10}
                  required
                  placeholder="Напишіть текст статті тут. Розділяйте абзаци порожнім рядком..."
                  value={editingArticle.content || ''}
                  onChange={(e) => setEditingArticle({ ...editingArticle, content: e.target.value })}
                  className="w-full text-sm sm:text-base border border-neutral-200 p-4 leading-relaxed focus:border-black focus:outline-none transition-colors font-serif"
                />
              </div>

              {/* Статус публікації */}
              <div className="pt-2 flex items-center gap-3">
                <input
                  type="checkbox"
                  id="publishedCheck"
                  checked={editingArticle.published !== false}
                  onChange={(e) => setEditingArticle({ ...editingArticle, published: e.target.checked })}
                  className="w-4 h-4 accent-black cursor-pointer"
                />
                <label htmlFor="publishedCheck" className="text-sm cursor-pointer select-none text-neutral-700">
                  Опублікувати на сайті (стаття буде видима читачам на головній сторінці)
                </label>
              </div>

              {/* Кнопки збереження */}
              <div className="pt-6 border-t border-neutral-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-5 py-2 text-xs sm:text-sm text-neutral-600 hover:text-black transition-colors cursor-pointer"
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-black text-white text-xs sm:text-sm tracking-wide hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  {isCreatingNew ? 'Опублікувати статтю' : 'Зберегти зміни'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* Список наявних статей */
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-neutral-100 mb-6 gap-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-serif font-medium text-black">
                  Редактор статей
                </h1>
                <p className="text-xs sm:text-sm text-neutral-500 mt-1">
                  Керування матеріалами журналу The Impart ({articles.length} {articles.length === 1 ? 'стаття' : 'статей'})
                </p>
              </div>
              <button
                onClick={handleStartCreate}
                className="self-start sm:self-auto flex items-center gap-2 bg-black text-white px-4 py-2 text-xs sm:text-sm tracking-wide hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Створити нову статтю</span>
              </button>
            </div>

            {articles.length === 0 ? (
              <div className="text-center py-20 border border-dashed border-neutral-200">
                <p className="text-neutral-500 text-sm mb-4">Наразі немає жодної статті.</p>
                <button
                  onClick={handleStartCreate}
                  className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-black underline underline-offset-4 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Створити першу публікацію
                </button>
              </div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {articles.map((art) => (
                  <div
                    key={art.id}
                    className="py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:bg-neutral-50/50 px-2 -mx-2 transition-colors rounded"
                  >
                    <div className="flex items-start gap-4">
                      {art.coverImage && (
                        <img
                          src={art.coverImage}
                          alt={art.title}
                          className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded shrink-0 bg-neutral-100"
                        />
                      )}
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[11px] uppercase tracking-wider text-neutral-500">
                            {art.category}
                          </span>
                          <span className="text-neutral-300">•</span>
                          <span className="text-xs text-neutral-400">{art.date}</span>
                          {!art.published && (
                            <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded uppercase tracking-wider">
                              Чернетка
                            </span>
                          )}
                        </div>
                        <h2 className="text-base sm:text-lg font-serif font-medium text-black group-hover:text-neutral-700 transition-colors">
                          {art.title}
                        </h2>
                        {art.excerpt && (
                          <p className="text-xs text-neutral-500 line-clamp-1 mt-1 max-w-xl">
                            {art.excerpt}
                          </p>
                        )}
                        <p className="text-[11px] text-neutral-400 mt-1">
                          {art.author} — {art.readTime}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        onClick={() => onViewArticleOnSite(art.id)}
                        className="p-2 text-neutral-500 hover:text-black transition-colors cursor-pointer"
                        title="Переглянути на сайті"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleStartEdit(art)}
                        className="p-2 text-neutral-500 hover:text-black transition-colors cursor-pointer"
                        title="Редагувати"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Видалити статтю «${art.title}»?`)) {
                            onDeleteArticle(art.id);
                            showNotification('Статтю видалено');
                          }
                        }}
                        className="p-2 text-neutral-400 hover:text-red-600 transition-colors cursor-pointer"
                        title="Видалити"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
