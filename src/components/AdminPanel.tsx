import React, { useState } from 'react';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit3,
  Eye,
  EyeOff,
  Check,
  ExternalLink,
  Globe,
  Image as ImageIcon,
  Video as VideoIcon,
  X,
} from 'lucide-react';
import { Article } from '../types';
import { formatTimeAgoOrDate } from '../utils/date';
import { ContentRenderer } from './ContentRenderer';

interface AdminPanelProps {
  articles: Article[];
  onSaveArticle: (article: Article) => Promise<void> | void;
  onDeleteArticle: (id: string) => Promise<void> | void;
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
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'hidden'>('all');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Вкладка редагування: 'edit' (текст) або 'preview' (попередній перегляд медіа)
  const [editorTab, setEditorTab] = useState<'edit' | 'preview'>('edit');

  // Модальне вікно вставки фото або YouTube
  const [mediaDialog, setMediaDialog] = useState<{
    type: 'photo' | 'youtube';
    url: string;
    caption: string;
  } | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  const handleStartCreate = () => {
    setErrorMsg(null);
    setIsCreatingNew(true);
    setEditorTab('edit');
    setEditingArticle({
      id: Date.now().toString(),
      title: '',
      excerpt: '',
      content: '',
      category: 'Есе',
      author: 'Редакція The Impart',
      coverImage: '',
      date: new Date().toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' }),
      published: true,
    });
  };

  const handleStartEdit = (article: Article) => {
    setErrorMsg(null);
    setIsCreatingNew(false);
    setEditorTab('edit');
    setEditingArticle({ ...article });
  };

  const handleCancel = () => {
    setErrorMsg(null);
    setEditingArticle(null);
    setIsCreatingNew(false);
    setEditorTab('edit');
  };

  // Швидке перемикання видимості статті (опублікована / прихована)
  const handleToggleVisibility = async (article: Article) => {
    const isCurrentlyPublished =
      article.published === true || String(article.published) === 'true' || (article.published as any) === 1;
    const nextPublished = !isCurrentlyPublished;

    setTogglingId(article.id);
    try {
      await onSaveArticle({
        ...article,
        published: nextPublished,
      });
      showNotification(
        nextPublished
          ? `Статтю «${article.title}» опубліковано на сайті.`
          : `Статтю «${article.title}» приховано з сайту.`
      );
    } catch (err: any) {
      console.error('Toggle visibility error:', err);
      showNotification(`Помилка: ${err.message || 'Не вдалося змінити видимість'}`);
    } finally {
      setTogglingId(null);
    }
  };

  const handleInsertMedia = () => {
    if (!mediaDialog || !mediaDialog.url.trim()) {
      setMediaDialog(null);
      return;
    }

    const trimmedUrl = mediaDialog.url.trim();
    let snippet = '';

    if (mediaDialog.type === 'youtube') {
      snippet = `\n\n${trimmedUrl}\n\n`;
    } else {
      if (mediaDialog.caption.trim()) {
        snippet = `\n\n![${mediaDialog.caption.trim()}](${trimmedUrl})\n\n`;
      } else {
        snippet = `\n\n${trimmedUrl}\n\n`;
      }
    }

    setEditingArticle((prev) => ({
      ...prev,
      content: (prev?.content || '').trimEnd() + snippet,
    }));

    showNotification(
      mediaDialog.type === 'youtube'
        ? 'Посилання на YouTube додано до статті'
        : 'Посилання на фото додано до статті'
    );
    setMediaDialog(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingArticle || !editingArticle.title?.trim()) {
      alert('Будь ласка, вкажіть заголовок статті.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    const isPub = editingArticle.published !== false && String(editingArticle.published) !== 'false';

    const finalArticle: Article = {
      id: editingArticle.id || Date.now().toString(),
      title: editingArticle.title.trim(),
      excerpt: editingArticle.excerpt?.trim() || '',
      content: editingArticle.content?.trim() || '',
      category: editingArticle.category?.trim() || 'Загальне',
      author: editingArticle.author?.trim() || 'Редакція The Impart',
      coverImage: editingArticle.coverImage?.trim() || undefined,
      date: editingArticle.date || new Date().toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' }),
      createdAt: editingArticle.createdAt || new Date().toISOString(),
      published: isPub,
    };

    try {
      await onSaveArticle(finalArticle);
      showNotification(
        isCreatingNew
          ? isPub
            ? 'Статтю успішно створено та опубліковано на сайті!'
            : 'Статтю збережено у чернетках (приховано)!'
          : isPub
          ? 'Зміни збережено (стаття активна на сайті)!'
          : 'Зміни збережено (стаття прихована від читачів)!'
      );
      setEditingArticle(null);
      setIsCreatingNew(false);
    } catch (err: any) {
      console.error('Save error:', err);
      setErrorMsg(err.message || 'Помилка збереження у базі даних.');
    } finally {
      setIsSaving(false);
    }
  };

  const publishedCount = articles.filter(
    (a) => a.published === true || String(a.published) === 'true' || (a.published as any) === 1
  ).length;
  const hiddenCount = articles.length - publishedCount;

  const filteredArticles = articles.filter((a) => {
    const isPub = a.published === true || String(a.published) === 'true' || (a.published as any) === 1;
    if (filterStatus === 'published') return isPub;
    if (filterStatus === 'hidden') return !isPub;
    return true;
  });

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
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onExitAdmin();
            }}
            className="text-xs text-neutral-500 hover:text-black flex items-center gap-1.5 transition-colors"
          >
            <Globe className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Відкрити сайт</span>
          </a>
        </div>
      </header>

      {/* Спливаюче сповіщення */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 bg-black text-white text-xs sm:text-sm px-4 py-3 rounded shadow-lg flex items-center gap-2 animate-fade-in">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{notification}</span>
        </div>
      )}

      {/* Діалог швидкої вставки посилання на Фото або YouTube */}
      {mediaDialog && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 border border-neutral-200 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 mb-4">
              <div className="flex items-center gap-2">
                {mediaDialog.type === 'youtube' ? (
                  <VideoIcon className="w-5 h-5 text-red-600" />
                ) : (
                  <ImageIcon className="w-5 h-5 text-neutral-700" />
                )}
                <h3 className="text-sm font-medium text-black">
                  {mediaDialog.type === 'youtube'
                    ? 'Вставити відео з YouTube'
                    : 'Вставити фото у статтю'}
                </h3>
              </div>
              <button
                onClick={() => setMediaDialog(null)}
                className="text-neutral-400 hover:text-black cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-left">
              <div>
                <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">
                  {mediaDialog.type === 'youtube' ? 'Посилання на YouTube відео *' : 'Посилання на фото (URL) *'}
                </label>
                <input
                  type="url"
                  autoFocus
                  placeholder={
                    mediaDialog.type === 'youtube'
                      ? 'https://www.youtube.com/watch?v=... або https://youtu.be/...'
                      : 'https://images.unsplash.com/... або https://...jpg'
                  }
                  value={mediaDialog.url}
                  onChange={(e) => setMediaDialog({ ...mediaDialog, url: e.target.value })}
                  className="w-full text-sm border border-neutral-200 rounded p-2.5 focus:border-black focus:outline-none font-sans"
                />
              </div>

              {mediaDialog.type === 'photo' && (
                <div>
                  <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">
                    Підпис до фото (необов'язково)
                  </label>
                  <input
                    type="text"
                    placeholder="Короткий підпис або автор фото"
                    value={mediaDialog.caption}
                    onChange={(e) => setMediaDialog({ ...mediaDialog, caption: e.target.value })}
                    className="w-full text-sm border border-neutral-200 rounded p-2.5 focus:border-black focus:outline-none font-sans"
                  />
                </div>
              )}

              <p className="text-xs text-neutral-500 bg-neutral-50 p-2.5 rounded">
                {mediaDialog.type === 'youtube'
                  ? 'Відео буде автоматично вбудовано у повний розмір із інтерактивним плеєром.'
                  : 'Фото буде відображено у високій якості на всю ширину тексту.'}
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMediaDialog(null)}
                  className="px-4 py-2 text-xs text-neutral-600 hover:text-black cursor-pointer"
                >
                  Скасувати
                </button>
                <button
                  type="button"
                  disabled={!mediaDialog.url.trim()}
                  onClick={handleInsertMedia}
                  className="px-4 py-2 bg-black text-white text-xs rounded hover:bg-neutral-800 disabled:opacity-50 cursor-pointer"
                >
                  Вставити у текст
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Основний вміст */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 sm:px-12 py-8 sm:py-12">
        {editingArticle ? (
          /* Форма редагування / створення статті */
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-between pb-6 border-b border-neutral-100 mb-8">
              <div>
                <h1 className="text-xl sm:text-2xl font-serif font-medium text-black">
                  {isCreatingNew ? 'Нова стаття' : 'Редагування статті'}
                </h1>
                <p className="text-xs text-neutral-500 mt-1">
                  Заповніть форму для збереження статті у базі даних Neon Postgres
                </p>
              </div>
              <button
                type="button"
                onClick={handleCancel}
                className="text-xs sm:text-sm text-neutral-500 hover:text-black transition-colors cursor-pointer"
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

              {/* Метадані статті (Рубрика та Автор — без часу читання) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-2">
                    Рубрика / Тема
                  </label>
                  <input
                    type="text"
                    placeholder="напр. Філософія, Архітектура"
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
              </div>

              {/* Головне зображення обкладинки */}
              <div className="pt-2">
                <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-2">
                  URL головної обкладинки (необов'язково)
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
                  Короткий опис (для картки на головній)
                </label>
                <textarea
                  rows={2}
                  placeholder="Одне або два речення про головну думку статті..."
                  value={editingArticle.excerpt || ''}
                  onChange={(e) => setEditingArticle({ ...editingArticle, excerpt: e.target.value })}
                  className="w-full text-sm border border-neutral-200 p-3 focus:border-black focus:outline-none transition-colors resize-none"
                />
              </div>

              {/* Повний текст статті + Вставка фото/відео та режим попереднього перегляду */}
              <div className="pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                  <label className="block text-xs uppercase tracking-wider text-neutral-500">
                    Текст статті *
                  </label>

                  {/* Панель інструментів для медіа */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMediaDialog({ type: 'photo', url: '', caption: '' })}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded transition-colors cursor-pointer"
                      title="Вставити посилання на фото у статтю"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-neutral-600" />
                      <span>+ Вставити фото</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMediaDialog({ type: 'youtube', url: '', caption: '' })}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-red-50 hover:bg-red-100 text-red-700 rounded transition-colors cursor-pointer"
                      title="Вставити посилання на відео з YouTube"
                    >
                      <VideoIcon className="w-3.5 h-3.5 text-red-600" />
                      <span>+ YouTube</span>
                    </button>

                    {/* Перемикач: Редактор / Прев'ю */}
                    <div className="flex items-center border border-neutral-200 rounded overflow-hidden ml-1">
                      <button
                        type="button"
                        onClick={() => setEditorTab('edit')}
                        className={`px-3 py-1 text-xs transition-colors cursor-pointer ${
                          editorTab === 'edit'
                            ? 'bg-black text-white font-medium'
                            : 'bg-white text-neutral-600 hover:text-black'
                        }`}
                      >
                        Текст
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditorTab('preview')}
                        className={`px-3 py-1 text-xs transition-colors cursor-pointer ${
                          editorTab === 'preview'
                            ? 'bg-black text-white font-medium'
                            : 'bg-white text-neutral-600 hover:text-black'
                        }`}
                      >
                        Прев'ю медіа
                      </button>
                    </div>
                  </div>
                </div>

                {editorTab === 'edit' ? (
                  <div>
                    <textarea
                      rows={12}
                      required
                      placeholder={`Напишіть текст статті тут. Розділяйте абзаци порожнім рядком.

Щоб додати фото або відео з YouTube, просто вставте посилання окремим рядком:
https://images.unsplash.com/...
https://www.youtube.com/watch?v=...`}
                      value={editingArticle.content || ''}
                      onChange={(e) => setEditingArticle({ ...editingArticle, content: e.target.value })}
                      className="w-full text-sm sm:text-base border border-neutral-200 p-4 leading-relaxed focus:border-black focus:outline-none transition-colors font-serif"
                    />
                    <div className="flex items-center justify-between text-[11px] text-neutral-400 mt-1.5">
                      <span>💡 Посилання на фото чи YouTube окремим рядком автоматично транслюються у повний плеєр та якісні зображення.</span>
                      <button
                        type="button"
                        onClick={() => setEditorTab('preview')}
                        className="text-black hover:underline cursor-pointer font-sans"
                      >
                        Переглянути вигляд
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border border-neutral-200 p-6 rounded bg-neutral-50/40 min-h-[300px]">
                    <div className="text-xs uppercase tracking-wider text-neutral-400 mb-6 font-sans border-b border-neutral-200 pb-2 flex items-center justify-between">
                      <span>Попередній перегляд статті:</span>
                      <span className="text-[11px] text-neutral-400">Як це бачитимуть читачі</span>
                    </div>
                    {editingArticle.content ? (
                      <ContentRenderer content={editingArticle.content} />
                    ) : (
                      <p className="text-neutral-400 italic font-serif text-sm">Текст статті порожній</p>
                    )}
                  </div>
                )}
              </div>

              {/* Перемикач видимості статті: Опубліковано або Приховано */}
              <div className="pt-2">
                <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-2.5">
                  Видимість статті на сайті
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingArticle({ ...editingArticle, published: true })}
                    className={`p-4 border text-left rounded transition-all cursor-pointer flex items-start gap-3.5 ${
                      editingArticle.published !== false
                        ? 'border-black bg-neutral-50 shadow-xs'
                        : 'border-neutral-200 hover:border-neutral-300 bg-white text-neutral-600'
                    }`}
                  >
                    <div className="w-5 h-5 rounded-full border border-current flex items-center justify-center shrink-0 mt-0.5">
                      {editingArticle.published !== false && (
                        <div className="w-2.5 h-2.5 rounded-full bg-black" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Eye className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm font-medium text-black">Опублікована</span>
                      </div>
                      <p className="text-xs text-neutral-500 mt-1">
                        Стаття одразу відображається читачам на головній сторінці сайту.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditingArticle({ ...editingArticle, published: false })}
                    className={`p-4 border text-left rounded transition-all cursor-pointer flex items-start gap-3.5 ${
                      editingArticle.published === false
                        ? 'border-black bg-neutral-50 shadow-xs'
                        : 'border-neutral-200 hover:border-neutral-300 bg-white text-neutral-600'
                    }`}
                  >
                    <div className="w-5 h-5 rounded-full border border-current flex items-center justify-center shrink-0 mt-0.5">
                      {editingArticle.published === false && (
                        <div className="w-2.5 h-2.5 rounded-full bg-black" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <EyeOff className="w-4 h-4 text-neutral-500" />
                        <span className="text-sm font-medium text-black">Прихована (чернетка)</span>
                      </div>
                      <p className="text-xs text-neutral-500 mt-1">
                        Зберігається у базі даних, але залишається невидимою для відвідувачів.
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Повідомлення про помилку збереження */}
              {errorMsg && (
                <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded">
                  {errorMsg}
                </div>
              )}

              {/* Кнопки збереження */}
              <div className="pt-6 border-t border-neutral-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleCancel}
                  className="px-5 py-2 text-xs sm:text-sm text-neutral-600 hover:text-black transition-colors cursor-pointer disabled:opacity-50"
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 bg-black text-white text-xs sm:text-sm tracking-wide hover:bg-neutral-800 transition-colors cursor-pointer disabled:opacity-60 flex items-center gap-2"
                >
                  {isSaving && (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  )}
                  <span>
                    {isSaving
                      ? 'Збереження...'
                      : isCreatingNew
                      ? editingArticle.published === false
                        ? 'Зберегти як приховану'
                        : 'Опублікувати статтю'
                      : editingArticle.published === false
                      ? 'Зберегти (приховати)'
                      : 'Зберегти зміни'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* Список статей у панелі */
          <div>
            {/* Заголовок та кнопка створення */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-neutral-100 mb-6 gap-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-serif font-medium text-black">
                  Редактор статей
                </h1>
                <p className="text-xs sm:text-sm text-neutral-500 mt-1">
                  Керування матеріалами журналу The Impart ({articles.length}{' '}
                  {articles.length === 1 ? 'матеріал' : 'матеріалів'})
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

            {/* Вкладки фільтрів видимості: Всі, Опубліковані, Приховані */}
            {articles.length > 0 && (
              <div className="flex items-center gap-2 pb-4 mb-4 border-b border-neutral-100 overflow-x-auto">
                <button
                  onClick={() => setFilterStatus('all')}
                  className={`px-3 py-1.5 text-xs rounded transition-colors cursor-pointer flex items-center gap-1.5 ${
                    filterStatus === 'all'
                      ? 'bg-black text-white font-medium'
                      : 'bg-neutral-100 text-neutral-600 hover:text-black hover:bg-neutral-200'
                  }`}
                >
                  <span>Всі</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    filterStatus === 'all' ? 'bg-neutral-800 text-white' : 'bg-neutral-200 text-neutral-600'
                  }`}>
                    {articles.length}
                  </span>
                </button>

                <button
                  onClick={() => setFilterStatus('published')}
                  className={`px-3 py-1.5 text-xs rounded transition-colors cursor-pointer flex items-center gap-1.5 ${
                    filterStatus === 'published'
                      ? 'bg-emerald-700 text-white font-medium'
                      : 'bg-neutral-100 text-neutral-600 hover:text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Опубліковані</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    filterStatus === 'published' ? 'bg-emerald-800 text-white' : 'bg-neutral-200 text-neutral-600'
                  }`}>
                    {publishedCount}
                  </span>
                </button>

                <button
                  onClick={() => setFilterStatus('hidden')}
                  className={`px-3 py-1.5 text-xs rounded transition-colors cursor-pointer flex items-center gap-1.5 ${
                    filterStatus === 'hidden'
                      ? 'bg-neutral-800 text-white font-medium'
                      : 'bg-neutral-100 text-neutral-600 hover:text-black hover:bg-neutral-200'
                  }`}
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Приховані</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    filterStatus === 'hidden' ? 'bg-neutral-700 text-white' : 'bg-neutral-200 text-neutral-600'
                  }`}>
                    {hiddenCount}
                  </span>
                </button>
              </div>
            )}

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
            ) : filteredArticles.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-neutral-200">
                <p className="text-neutral-500 text-sm">
                  {filterStatus === 'hidden'
                    ? 'Прихованих статей немає. Усі статті опубліковані на сайті.'
                    : 'Опублікованих статей немає.'}
                </p>
                <button
                  onClick={() => setFilterStatus('all')}
                  className="mt-3 text-xs text-black underline underline-offset-4 cursor-pointer"
                >
                  Показати всі статті
                </button>
              </div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {filteredArticles.map((art) => {
                  const isPub =
                    art.published === true || String(art.published) === 'true' || (art.published as any) === 1;
                  const isToggling = togglingId === art.id;
                  const timeDisplay = formatTimeAgoOrDate(art.createdAt, art.date, art.id);

                  return (
                    <div
                      key={art.id}
                      className={`py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group px-3 -mx-3 transition-colors rounded ${
                        isPub
                          ? 'hover:bg-neutral-50/60'
                          : 'bg-neutral-50/50 hover:bg-neutral-100/60 border-l-2 border-neutral-300'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        {art.coverImage ? (
                          <img
                            src={art.coverImage}
                            alt={art.title}
                            className={`w-16 h-16 sm:w-20 sm:h-20 object-cover rounded shrink-0 bg-neutral-100 ${
                              !isPub ? 'grayscale opacity-75' : ''
                            }`}
                          />
                        ) : (
                          <div
                            className={`w-16 h-16 sm:w-20 sm:h-20 rounded shrink-0 flex items-center justify-center text-xs font-serif ${
                              isPub ? 'bg-neutral-100 text-neutral-400' : 'bg-neutral-200 text-neutral-500'
                            }`}
                          >
                            The Impart
                          </div>
                        )}
                        <div>
                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            {/* Статус видимості */}
                            {isPub ? (
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Опубліковано
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-neutral-600 bg-neutral-200/70 px-2 py-0.5 rounded">
                                <EyeOff className="w-3 h-3 text-neutral-500" />
                                Приховано
                              </span>
                            )}

                            <span className="text-neutral-300">•</span>
                            <span className="text-[11px] uppercase tracking-wider text-neutral-500">
                              {art.category}
                            </span>
                            {timeDisplay && (
                              <>
                                <span className="text-neutral-300">•</span>
                                <span className="text-xs text-neutral-400">{timeDisplay}</span>
                              </>
                            )}
                          </div>

                          <h2
                            className={`text-base sm:text-lg font-serif font-medium transition-colors ${
                              isPub ? 'text-black group-hover:text-neutral-700' : 'text-neutral-600'
                            }`}
                          >
                            {art.title}
                          </h2>
                          {art.excerpt && (
                            <p className="text-xs text-neutral-500 line-clamp-1 mt-1 max-w-xl">
                              {art.excerpt}
                            </p>
                          )}
                          <p className="text-[11px] text-neutral-400 mt-1">
                            {art.author}
                          </p>
                        </div>
                      </div>

                      {/* Панель дій над статтею */}
                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                        {/* Кнопка швидкого приховування / показу */}
                        <button
                          onClick={() => handleToggleVisibility(art)}
                          disabled={isToggling}
                          className={`p-2 rounded transition-colors cursor-pointer flex items-center gap-1.5 text-xs ${
                            isPub
                              ? 'text-neutral-500 hover:text-amber-700 hover:bg-amber-50'
                              : 'text-neutral-600 hover:text-emerald-700 hover:bg-emerald-50'
                          } disabled:opacity-50`}
                          title={
                            isPub
                              ? 'Приховати статтю з сайту (перевести в чернетки)'
                              : 'Опублікувати статтю на сайті'
                          }
                        >
                          {isToggling ? (
                            <div className="w-4 h-4 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin" />
                          ) : isPub ? (
                            <>
                              <EyeOff className="w-4 h-4" />
                              <span className="hidden md:inline">Сховати</span>
                            </>
                          ) : (
                            <>
                              <Eye className="w-4 h-4 text-emerald-600" />
                              <span className="hidden md:inline text-emerald-700 font-medium">Показати</span>
                            </>
                          )}
                        </button>

                        {/* Перегляд на сайті */}
                        <button
                          onClick={() => onViewArticleOnSite(art.id)}
                          className="p-2 text-neutral-500 hover:text-black hover:bg-neutral-100 rounded transition-colors cursor-pointer"
                          title="Переглянути статтю"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>

                        {/* Редагування */}
                        <button
                          onClick={() => handleStartEdit(art)}
                          className="p-2 text-neutral-500 hover:text-black hover:bg-neutral-100 rounded transition-colors cursor-pointer"
                          title="Редагувати статтю"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        {/* Видалення */}
                        <button
                          onClick={() => {
                            if (confirm(`Видалити статтю «${art.title}» назавжди з бази даних?`)) {
                              onDeleteArticle(art.id);
                              showNotification('Статтю назавжди видалено.');
                            }
                          }}
                          className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                          title="Видалити назавжди"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
