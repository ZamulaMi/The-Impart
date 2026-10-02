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
  Languages,
  Copy,
  FileText,
  Share2,
  Upload,
} from 'lucide-react';
import { Article, SiteSocialLinks } from '../types';
import { formatTimeAgoOrDate } from '../utils/date';
import { ContentRenderer } from './ContentRenderer';
import { SocialLinksManager } from './SocialLinksManager';
import { RichArticleEditor } from './RichArticleEditor';

interface AdminPanelProps {
  articles: Article[];
  onSaveArticle: (article: Article) => Promise<void> | void;
  onDeleteArticle: (id: string) => Promise<void> | void;
  onExitAdmin: () => void;
  onViewArticleOnSite: (id: string) => void;
  socialLinks: SiteSocialLinks;
  onSaveSocialLinks: (links: SiteSocialLinks) => Promise<void> | void;
  onRefreshSocialLinks?: () => Promise<void>;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  articles,
  onSaveArticle,
  onDeleteArticle,
  onExitAdmin,
  onViewArticleOnSite,
  socialLinks,
  onSaveSocialLinks,
  onRefreshSocialLinks,
}) => {
  // Розділ адмін-панелі: за замовчуванням "Редактор статей" ('articles') або "Соц. мережі" ('social_links')
  const [activeSection, setActiveSection] = useState<'articles' | 'social_links'>('articles');

  const [editingArticle, setEditingArticle] = useState<Partial<Article> | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'published_ua' | 'published_en' | 'hidden'>('all');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Мовна вкладка у редакторі форми: 'ua' або 'en'
  const [formLangTab, setFormLangTab] = useState<'ua' | 'en'>('ua');

  // Вкладка перегляду контенту: 'edit' або 'preview'
  const [editorTab, setEditorTab] = useState<'edit' | 'preview'>('edit');

  // Модальне вікно вставки фото або YouTube
  const [mediaDialog, setMediaDialog] = useState<{
    type: 'photo' | 'youtube';
    url: string;
    caption: string;
  } | null>(null);

  const coverFileInputRef = React.useRef<HTMLInputElement>(null);
  const [isUploadingCover, setIsUploadingCover] = useState(false);

  const handleCoverFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingCover(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const maxDim = 1920;
            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              resolve(event.target?.result as string);
              return;
            }
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.88));
          };
          img.onerror = () => reject(new Error('Не вдалося завантажити зображення'));
          img.src = event.target?.result as string;
        };
        reader.onerror = () => reject(new Error('Помилка читання файлу'));
        reader.readAsDataURL(file);
      });

      let finalUrl = dataUrl;
      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: dataUrl, filename: file.name }),
        });
        if (res.ok) {
          const resJson = await res.json();
          if (resJson.url) finalUrl = resJson.url;
        }
      } catch {}

      setEditingArticle((prev) => ({
        ...prev,
        coverImage: finalUrl,
      }));
      showNotification('Головну обкладинку успішно завантажено!');
    } catch {
      showNotification('Помилка завантаження фотографії');
    } finally {
      setIsUploadingCover(false);
    }
  };

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  const handleStartCreate = () => {
    setErrorMsg(null);
    setIsCreatingNew(true);
    setFormLangTab('ua');
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
      titleEn: '',
      excerptEn: '',
      contentEn: '',
      categoryEn: 'Essay',
      publishedEn: false,
    });
  };

  const handleStartEdit = (article: Article) => {
    setErrorMsg(null);
    setIsCreatingNew(false);
    setFormLangTab('ua');
    setEditorTab('edit');
    setEditingArticle({ ...article });
  };

  const handleCancel = () => {
    setErrorMsg(null);
    setEditingArticle(null);
    setIsCreatingNew(false);
    setEditorTab('edit');
  };

  // Швидке перемикання видимості статті для української версії
  const handleToggleUaVisibility = async (article: Article) => {
    const isCurrentlyPublished =
      article.published === true || String(article.published) === 'true' || (article.published as any) === 1;
    const nextPublished = !isCurrentlyPublished;

    setTogglingId(`ua_${article.id}`);
    try {
      await onSaveArticle({
        ...article,
        published: nextPublished,
      });
      showNotification(
        nextPublished
          ? `Українську версію «${article.title}» опубліковано на сайті.`
          : `Українську версію «${article.title}» приховано з сайту.`
      );
    } catch (err: any) {
      console.error('Toggle visibility error:', err);
      showNotification(`Помилка: ${err.message || 'Не вдалося змінити видимість'}`);
    } finally {
      setTogglingId(null);
    }
  };

  // Швидке перемикання видимості статті для англійської версії
  const handleToggleEnVisibility = async (article: Article) => {
    if (!article.titleEn?.trim()) {
      showNotification('Спочатку заповніть англійську версію статті у редакторі.');
      return;
    }

    const isCurrentlyPublished =
      article.publishedEn === true || String(article.publishedEn) === 'true' || (article.publishedEn as any) === 1;
    const nextPublished = !isCurrentlyPublished;

    setTogglingId(`en_${article.id}`);
    try {
      await onSaveArticle({
        ...article,
        publishedEn: nextPublished,
      });
      showNotification(
        nextPublished
          ? `Англійську версію «${article.titleEn}» опубліковано на сайті.`
          : `Англійську версію «${article.titleEn}» приховано з сайту.`
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

    if (formLangTab === 'ua') {
      setEditingArticle((prev) => ({
        ...prev,
        content: (prev?.content || '').trimEnd() + snippet,
      }));
    } else {
      setEditingArticle((prev) => ({
        ...prev,
        contentEn: (prev?.contentEn || '').trimEnd() + snippet,
      }));
    }

    showNotification(
      mediaDialog.type === 'youtube'
        ? 'Посилання на YouTube додано до тексту'
        : 'Посилання на фото додано до тексту'
    );
    setMediaDialog(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingArticle || !editingArticle.title?.trim()) {
      alert('Будь ласка, вкажіть заголовок статті для основної (української) версії.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    const isPub = editingArticle.published !== false && String(editingArticle.published) !== 'false';
    const isPubEn =
      editingArticle.publishedEn === true || String(editingArticle.publishedEn) === 'true';

    const finalArticle: Article = {
      id: editingArticle.id || Date.now().toString(),
      // Українська версія
      title: editingArticle.title.trim(),
      excerpt: editingArticle.excerpt?.trim() || '',
      content: editingArticle.content?.trim() || '',
      category: editingArticle.category?.trim() || 'Загальне',
      published: isPub,
      // Загальні метадані
      author: editingArticle.author?.trim() || 'Редакція The Impart',
      coverImage: editingArticle.coverImage?.trim() || undefined,
      date: editingArticle.date || new Date().toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' }),
      createdAt: editingArticle.createdAt || new Date().toISOString(),
      // Англійська версія
      titleEn: editingArticle.titleEn?.trim() || undefined,
      excerptEn: editingArticle.excerptEn?.trim() || undefined,
      contentEn: editingArticle.contentEn?.trim() || undefined,
      categoryEn: editingArticle.categoryEn?.trim() || undefined,
      publishedEn: isPubEn,
    };

    try {
      await onSaveArticle(finalArticle);
      showNotification(
        isCreatingNew
          ? 'Статтю успішно створено та збережено у базі даних!'
          : 'Зміни успішно збережено!'
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

  const filteredArticles = articles.filter((a) => {
    const isPubUa = a.published === true || String(a.published) === 'true' || (a.published as any) === 1;
    const isPubEn = a.publishedEn === true || String(a.publishedEn) === 'true' || (a.publishedEn as any) === 1;

    if (filterStatus === 'published_ua') return isPubUa;
    if (filterStatus === 'published_en') return isPubEn;
    if (filterStatus === 'hidden') return !isPubUa && !isPubEn;
    return true;
  });

  const uaPublishedCount = articles.filter(
    (a) => a.published === true || String(a.published) === 'true' || (a.published as any) === 1
  ).length;
  const enPublishedCount = articles.filter(
    (a) => a.publishedEn === true || String(a.publishedEn) === 'true' || (a.publishedEn as any) === 1
  ).length;

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
            <span className="hidden sm:inline">На сайт</span>
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
            <span className="hidden md:inline">Головна сторінка</span>
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
                  ? 'Відео буде вбудовано на всю ширину тексту зі зручним плеєром.'
                  : 'Зображення відобразиться у високій якості на всю ширину сторінки.'}
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
                  Вставити у текст ({formLangTab === 'ua' ? 'UA' : 'EN'})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Основний контейнер з лівим сайдбаром меню та робочою областю */}
      <div className="flex-1 flex flex-col md:flex-row w-full max-w-7xl mx-auto">
        {/* Лівий сайдбар з кнопками опцій */}
        <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-neutral-100 p-6 shrink-0 bg-neutral-50/40">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-3 px-3">
            Розділи
          </div>
          <nav className="flex flex-row md:flex-col gap-1.5">
            {/* Опція 1: Редактор статей (по замовчуванню) */}
            <button
              type="button"
              onClick={() => {
                setActiveSection('articles');
                setEditingArticle(null);
                setIsCreatingNew(false);
              }}
              className={`flex-1 md:flex-initial flex items-center gap-3 px-3.5 py-2.5 text-xs sm:text-sm font-medium rounded-md transition-all cursor-pointer text-left ${
                activeSection === 'articles'
                  ? 'bg-black text-white shadow-xs'
                  : 'text-neutral-600 hover:text-black hover:bg-neutral-100'
              }`}
            >
              <FileText className="w-4 h-4 shrink-0" />
              <span>Редактор статей</span>
            </button>

            {/* Опція 2: Соц. мережі */}
            <button
              type="button"
              onClick={() => {
                setActiveSection('social_links');
                setEditingArticle(null);
                setIsCreatingNew(false);
              }}
              className={`flex-1 md:flex-initial flex items-center gap-3 px-3.5 py-2.5 text-xs sm:text-sm font-medium rounded-md transition-all cursor-pointer text-left ${
                activeSection === 'social_links'
                  ? 'bg-black text-white shadow-xs'
                  : 'text-neutral-600 hover:text-black hover:bg-neutral-100'
              }`}
            >
              <Share2 className="w-4 h-4 shrink-0" />
              <span>Соц. мережі</span>
            </button>
          </nav>
        </aside>

        {/* Робоча область вибраного розділу */}
        <main className="flex-1 w-full px-6 sm:px-12 py-8 sm:py-12 overflow-x-hidden">
          {activeSection === 'social_links' ? (
            <SocialLinksManager
              socialLinks={socialLinks}
              onSaveSocialLinks={onSaveSocialLinks}
              onRefreshSocialLinks={onRefreshSocialLinks}
              showNotification={showNotification}
            />
          ) : editingArticle ? (
          /* Форма редагування / створення статті */
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-between pb-6 border-b border-neutral-100 mb-6">
              <div>
                <h1 className="text-xl sm:text-2xl font-serif font-medium text-black">
                  {isCreatingNew ? 'Нова стаття' : 'Редагування статті'}
                </h1>
                <p className="text-xs text-neutral-500 mt-1">
                  Основна назва статті в списку завжди українською, переклад створюється на вкладці «English».
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

            {/* ВКЛАДКИ МОВ: УКРАЇНСЬКА ТА АНГЛІЙСЬКА */}
            <div className="flex items-center gap-2 border-b border-neutral-200 pb-px mb-8">
              <button
                type="button"
                onClick={() => setFormLangTab('ua')}
                className={`flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-all cursor-pointer ${
                  formLangTab === 'ua'
                    ? 'border-black text-black'
                    : 'border-transparent text-neutral-400 hover:text-neutral-700'
                }`}
              >
                <span className="text-base">🇺🇦</span>
                <span>Українська версія (основна)</span>
                {editingArticle.published !== false ? (
                  <span className="w-2 h-2 rounded-full bg-emerald-500" title="Опубліковано на UA" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-neutral-300" title="Приховано на UA" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setFormLangTab('en')}
                className={`flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-all cursor-pointer ${
                  formLangTab === 'en'
                    ? 'border-black text-black'
                    : 'border-transparent text-neutral-400 hover:text-neutral-700'
                }`}
              >
                <span className="text-base">🇬🇧</span>
                <span>English version</span>
                {editingArticle.publishedEn ? (
                  <span className="w-2 h-2 rounded-full bg-emerald-500" title="Опубліковано на EN" />
                ) : editingArticle.titleEn?.trim() ? (
                  <span className="w-2 h-2 rounded-full bg-amber-400" title="Чернетка EN" />
                ) : (
                  <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-normal">
                    (порожньо)
                  </span>
                )}
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* ЗАГАЛЬНІ ПОЛЯ (Автор та обкладинка — спільні для обох мов) */}
              <div className="p-4 bg-neutral-50/70 border border-neutral-200/80 rounded-lg space-y-4">
                <div className="flex items-center justify-between text-xs text-neutral-500 uppercase tracking-wider">
                  <span>Загальні параметри матеріалу</span>
                  <span className="text-[10px] text-neutral-400">Спільні для UA та EN</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">
                      Автор статті
                    </label>
                    <input
                      type="text"
                      placeholder="Ім'я автора"
                      value={editingArticle.author || ''}
                      onChange={(e) => setEditingArticle({ ...editingArticle, author: e.target.value })}
                      className="w-full text-sm border-b border-neutral-200 pb-1.5 focus:border-black focus:outline-none transition-colors bg-transparent"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs uppercase tracking-wider text-neutral-500">
                        Головна обкладинка статті
                      </label>
                      <button
                        type="button"
                        onClick={() => coverFileInputRef.current?.click()}
                        disabled={isUploadingCover}
                        className="inline-flex items-center gap-1.5 text-xs text-neutral-800 hover:text-black font-medium cursor-pointer underline disabled:opacity-50"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{isUploadingCover ? 'Завантаження...' : 'Завантажити файл'}</span>
                      </button>
                    </div>
                    <input
                      type="file"
                      ref={coverFileInputRef}
                      accept="image/*"
                      onChange={handleCoverFileChange}
                      className="hidden"
                    />
                    <input
                      type="url"
                      placeholder="https://images.unsplash.com/... або завантажте файл кнопкою вище"
                      value={editingArticle.coverImage || ''}
                      onChange={(e) => setEditingArticle({ ...editingArticle, coverImage: e.target.value })}
                      className="w-full text-sm border-b border-neutral-200 pb-1.5 focus:border-black focus:outline-none transition-colors bg-transparent font-mono text-xs"
                    />
                  </div>
                </div>

                {editingArticle.coverImage && (
                  <div className="relative aspect-[16/9] max-h-48 overflow-hidden rounded-md bg-neutral-100 border border-neutral-200 group">
                    <img
                      src={editingArticle.coverImage}
                      alt="Обкладинка"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setEditingArticle({ ...editingArticle, coverImage: '' })}
                      title="Видалити обкладинку"
                      className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-black text-white rounded-full transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* ВМІСТ УКРАЇНСЬКОЇ ВЕРСІЇ */}
              {formLangTab === 'ua' && (
                <div className="space-y-6 animate-fade-in">
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                    <span className="text-xs uppercase tracking-wider font-medium text-black flex items-center gap-1.5">
                      <span>🇺🇦</span> Український текст статті
                    </span>
                    <span className="text-xs text-neutral-400">Основна версія</span>
                  </div>

                  {/* Заголовок UA */}
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-2">
                      Заголовок статті (UA) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Введіть заголовок статті українською..."
                      value={editingArticle.title || ''}
                      onChange={(e) => setEditingArticle({ ...editingArticle, title: e.target.value })}
                      className="w-full text-lg sm:text-xl font-serif border-b border-neutral-200 pb-2 focus:border-black focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Рубрика UA */}
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-2">
                      Рубрика / Тема (UA)
                    </label>
                    <input
                      type="text"
                      placeholder="напр. Філософія, Архітектура, Есе"
                      value={editingArticle.category || ''}
                      onChange={(e) => setEditingArticle({ ...editingArticle, category: e.target.value })}
                      className="w-full text-sm border-b border-neutral-200 pb-1.5 focus:border-black focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Короткий опис UA */}
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-2">
                      Короткий опис (для списку на головній)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Одне-два речення про головну думку статті українською..."
                      value={editingArticle.excerpt || ''}
                      onChange={(e) => setEditingArticle({ ...editingArticle, excerpt: e.target.value })}
                      className="w-full text-sm border border-neutral-200 p-3 focus:border-black focus:outline-none transition-colors resize-none"
                    />
                  </div>

                  {/* Текст UA + розширені інструменти форматування */}
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-2">
                      Текст статті (UA) *
                    </label>
                    <RichArticleEditor
                      value={editingArticle.content || ''}
                      onChange={(val) => setEditingArticle({ ...editingArticle, content: val })}
                      placeholder="Напишіть текст статті українською тут..."
                      lang="ua"
                      minHeight="420px"
                    />
                  </div>

                  {/* Перемикач видимості української версії */}
                  <div className="pt-2">
                    <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-2">
                      Видимість на українській версії сайту
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setEditingArticle({ ...editingArticle, published: true })}
                        className={`p-3.5 border text-left rounded transition-all cursor-pointer flex items-start gap-3 ${
                          editingArticle.published !== false
                            ? 'border-black bg-neutral-50 ring-1 ring-black'
                            : 'border-neutral-200 hover:border-neutral-300 bg-white'
                        }`}
                      >
                        <Eye className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <div className="text-xs sm:text-sm font-medium text-black">Опубліковано для UA</div>
                          <div className="text-[11px] text-neutral-500 mt-0.5">
                            Відображається читачам, коли обрана мова UA
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setEditingArticle({ ...editingArticle, published: false })}
                        className={`p-3.5 border text-left rounded transition-all cursor-pointer flex items-start gap-3 ${
                          editingArticle.published === false
                            ? 'border-black bg-neutral-50 ring-1 ring-black'
                            : 'border-neutral-200 hover:border-neutral-300 bg-white'
                        }`}
                      >
                        <EyeOff className="w-4 h-4 text-neutral-500 shrink-0 mt-0.5" />
                        <div>
                          <div className="text-xs sm:text-sm font-medium text-black">Приховано для UA</div>
                          <div className="text-[11px] text-neutral-500 mt-0.5">
                            Зберігається в базі, але не показується на сайті
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ВМІСТ АНГЛІЙСЬКОЇ ВЕРСІЇ */}
              {formLangTab === 'en' && (
                <div className="space-y-6 animate-fade-in">
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                    <span className="text-xs uppercase tracking-wider font-medium text-black flex items-center gap-1.5">
                      <span>🇬🇧</span> English Article Version
                    </span>
                    {editingArticle.content && !editingArticle.contentEn && (
                      <button
                        type="button"
                        onClick={() => {
                          // Допомагає скопіювати текст або медіа-посилання з UA для перекладу
                          setEditingArticle({
                            ...editingArticle,
                            categoryEn: editingArticle.categoryEn || editingArticle.category,
                            contentEn: editingArticle.content,
                          });
                          showNotification('Структуру тексту скопійовано з української версії для перекладу.');
                        }}
                        className="text-xs text-neutral-600 hover:text-black flex items-center gap-1 underline cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Скопіювати з UA для перекладу</span>
                      </button>
                    )}
                  </div>

                  {/* Заголовок EN */}
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-2">
                      Article Title (EN)
                    </label>
                    <input
                      type="text"
                      placeholder="Enter article title in English..."
                      value={editingArticle.titleEn || ''}
                      onChange={(e) => setEditingArticle({ ...editingArticle, titleEn: e.target.value })}
                      className="w-full text-lg sm:text-xl font-serif border-b border-neutral-200 pb-2 focus:border-black focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Рубрика EN */}
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-2">
                      Topic / Category (EN)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Philosophy, Architecture, Essay"
                      value={editingArticle.categoryEn || ''}
                      onChange={(e) => setEditingArticle({ ...editingArticle, categoryEn: e.target.value })}
                      className="w-full text-sm border-b border-neutral-200 pb-1.5 focus:border-black focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Короткий опис EN */}
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-2">
                      Excerpt / Summary (EN)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="One or two sentences summarizing the article in English..."
                      value={editingArticle.excerptEn || ''}
                      onChange={(e) => setEditingArticle({ ...editingArticle, excerptEn: e.target.value })}
                      className="w-full text-sm border border-neutral-200 p-3 focus:border-black focus:outline-none transition-colors resize-none"
                    />
                  </div>

                  {/* Текст EN + розширені інструменти форматування */}
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-2">
                      Article Content (EN)
                    </label>
                    <RichArticleEditor
                      value={editingArticle.contentEn || ''}
                      onChange={(val) => setEditingArticle({ ...editingArticle, contentEn: val })}
                      placeholder="Write English article content here..."
                      lang="en"
                      minHeight="420px"
                    />
                  </div>

                  {/* Перемикач видимості англійської версії */}
                  <div className="pt-2">
                    <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-2">
                      Видимість на англійській версії сайту
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setEditingArticle({ ...editingArticle, publishedEn: true })}
                        className={`p-3.5 border text-left rounded transition-all cursor-pointer flex items-start gap-3 ${
                          editingArticle.publishedEn === true
                            ? 'border-black bg-neutral-50 ring-1 ring-black'
                            : 'border-neutral-200 hover:border-neutral-300 bg-white'
                        }`}
                      >
                        <Eye className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <div className="text-xs sm:text-sm font-medium text-black">Опубліковано для EN</div>
                          <div className="text-[11px] text-neutral-500 mt-0.5">
                            Стаття з'явиться на сайті, коли читач перемкнеться на англійську мову
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setEditingArticle({ ...editingArticle, publishedEn: false })}
                        className={`p-3.5 border text-left rounded transition-all cursor-pointer flex items-start gap-3 ${
                          editingArticle.publishedEn !== true
                            ? 'border-black bg-neutral-50 ring-1 ring-black'
                            : 'border-neutral-200 hover:border-neutral-300 bg-white'
                        }`}
                      >
                        <EyeOff className="w-4 h-4 text-neutral-500 shrink-0 mt-0.5" />
                        <div>
                          <div className="text-xs sm:text-sm font-medium text-black">Приховано для EN (чернетка)</div>
                          <div className="text-[11px] text-neutral-500 mt-0.5">
                            Не відображається в англійській версії сайту
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Повідомлення про помилку збереження */}
              {errorMsg && (
                <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded">
                  {errorMsg}
                </div>
              )}

              {/* Кнопки збереження */}
              <div className="pt-6 border-t border-neutral-100 flex items-center justify-between">
                <div className="text-xs text-neutral-500">
                  {formLangTab === 'ua' ? (
                    <button
                      type="button"
                      onClick={() => setFormLangTab('en')}
                      className="text-black hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <span>Перейти до редагування англійської версії 🇬🇧</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setFormLangTab('ua')}
                      className="text-black hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <span>Повернутися до української версії 🇺🇦</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3">
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
                    <span>{isSaving ? 'Збереження...' : isCreatingNew ? 'Створити матеріал' : 'Зберегти зміни'}</span>
                  </button>
                </div>
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
                  Назва матеріалів у списку українською. Керування українською та англійською версіями ({articles.length}{' '}
                  {articles.length === 1 ? 'стаття' : 'статей'})
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

            {/* Вкладки фільтрів видимості: Всі, Опубліковані UA, Опубліковані EN, Приховані */}
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
                  <span>Всі матеріали</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    filterStatus === 'all' ? 'bg-neutral-800 text-white' : 'bg-neutral-200 text-neutral-600'
                  }`}>
                    {articles.length}
                  </span>
                </button>

                <button
                  onClick={() => setFilterStatus('published_ua')}
                  className={`px-3 py-1.5 text-xs rounded transition-colors cursor-pointer flex items-center gap-1.5 ${
                    filterStatus === 'published_ua'
                      ? 'bg-emerald-700 text-white font-medium'
                      : 'bg-neutral-100 text-neutral-600 hover:text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  <span>🇺🇦 Опубліковані UA</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    filterStatus === 'published_ua' ? 'bg-emerald-800 text-white' : 'bg-neutral-200 text-neutral-600'
                  }`}>
                    {uaPublishedCount}
                  </span>
                </button>

                <button
                  onClick={() => setFilterStatus('published_en')}
                  className={`px-3 py-1.5 text-xs rounded transition-colors cursor-pointer flex items-center gap-1.5 ${
                    filterStatus === 'published_en'
                      ? 'bg-blue-700 text-white font-medium'
                      : 'bg-neutral-100 text-neutral-600 hover:text-blue-700 hover:bg-blue-50'
                  }`}
                >
                  <span>🇬🇧 Опубліковані EN</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    filterStatus === 'published_en' ? 'bg-blue-800 text-white' : 'bg-neutral-200 text-neutral-600'
                  }`}>
                    {enPublishedCount}
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
                <p className="text-neutral-500 text-sm">Немає статей для обраного фільтра.</p>
                <button
                  onClick={() => setFilterStatus('all')}
                  className="mt-3 text-xs text-black underline underline-offset-4 cursor-pointer"
                >
                  Показати всі матеріали
                </button>
              </div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {filteredArticles.map((art) => {
                  const isPubUa =
                    art.published === true || String(art.published) === 'true' || (art.published as any) === 1;
                  const isPubEn =
                    art.publishedEn === true || String(art.publishedEn) === 'true' || (art.publishedEn as any) === 1;
                  const hasEn = Boolean(art.titleEn?.trim());

                  const isTogglingUa = togglingId === `ua_${art.id}`;
                  const isTogglingEn = togglingId === `en_${art.id}`;
                  const timeDisplay = formatTimeAgoOrDate(art.createdAt, art.date, art.id, 'ua');

                  return (
                    <div
                      key={art.id}
                      className={`py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group px-3 -mx-3 transition-colors rounded ${
                        isPubUa || isPubEn
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
                              !isPubUa && !isPubEn ? 'grayscale opacity-75' : ''
                            }`}
                          />
                        ) : (
                          <div
                            className={`w-16 h-16 sm:w-20 sm:h-20 rounded shrink-0 flex items-center justify-center text-xs font-serif ${
                              isPubUa ? 'bg-neutral-100 text-neutral-400' : 'bg-neutral-200 text-neutral-500'
                            }`}
                          >
                            The Impart
                          </div>
                        )}
                        <div>
                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            {/* Статус UA */}
                            {isPubUa ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                🇺🇦 UA: Live
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">
                                🇺🇦 UA: Сховано
                              </span>
                            )}

                            {/* Статус EN */}
                            {isPubEn ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                🇬🇧 EN: Live
                              </span>
                            ) : hasEn ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                                🇬🇧 EN: Чернетка
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded">
                                🇬🇧 EN: Немає
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

                          {/* ГОЛОВНА НАЗВА В СПИСКУ ЗАВЖДИ УКРАЇНСЬКОЮ */}
                          <h2 className="text-base sm:text-lg font-serif font-medium text-black group-hover:text-neutral-700 transition-colors">
                            {art.title}
                          </h2>

                          {/* Додаткова плашка, якщо є англійський переклад */}
                          {art.titleEn && (
                            <p className="text-xs text-neutral-400 italic mt-0.5 flex items-center gap-1">
                              <span>EN:</span>
                              <span>{art.titleEn}</span>
                            </p>
                          )}

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
                        {/* Кнопка швидкого приховування/публікації для UA */}
                        <button
                          onClick={() => handleToggleUaVisibility(art)}
                          disabled={isTogglingUa}
                          className={`p-2 rounded transition-colors cursor-pointer flex items-center gap-1 text-xs ${
                            isPubUa
                              ? 'text-neutral-600 hover:text-amber-700 hover:bg-amber-50'
                              : 'text-neutral-500 hover:text-emerald-700 hover:bg-emerald-50'
                          } disabled:opacity-50`}
                          title={
                            isPubUa
                              ? 'Сховати українську версію з сайту'
                              : 'Опублікувати українську версію на сайті'
                          }
                        >
                          {isTogglingUa ? (
                            <div className="w-3.5 h-3.5 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <>
                              <span className="text-[11px] font-medium">🇺🇦</span>
                              <span className="hidden lg:inline">{isPubUa ? 'Сховати' : 'Показати'}</span>
                            </>
                          )}
                        </button>

                        {/* Кнопка швидкого приховування/публікації для EN */}
                        {hasEn && (
                          <button
                            onClick={() => handleToggleEnVisibility(art)}
                            disabled={isTogglingEn}
                            className={`p-2 rounded transition-colors cursor-pointer flex items-center gap-1 text-xs ${
                              isPubEn
                                ? 'text-neutral-600 hover:text-amber-700 hover:bg-amber-50'
                                : 'text-neutral-500 hover:text-blue-700 hover:bg-blue-50'
                            } disabled:opacity-50`}
                            title={
                              isPubEn
                                ? 'Сховати англійську версію з сайту'
                                : 'Опублікувати англійську версію на сайті'
                            }
                          >
                            {isTogglingEn ? (
                              <div className="w-3.5 h-3.5 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <>
                                <span className="text-[11px] font-medium">🇬🇧</span>
                                <span className="hidden lg:inline">{isPubEn ? 'Hide' : 'Publish'}</span>
                              </>
                            )}
                          </button>
                        )}

                        {/* Перегляд на сайті */}
                        <button
                          onClick={() => onViewArticleOnSite(art.id)}
                          className="p-2 text-neutral-500 hover:text-black hover:bg-neutral-100 rounded transition-colors cursor-pointer"
                          title="Переглянути на сайті"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>

                        {/* Редагування */}
                        <button
                          onClick={() => handleStartEdit(art)}
                          className="p-2 text-neutral-500 hover:text-black hover:bg-neutral-100 rounded transition-colors cursor-pointer"
                          title="Редагувати статтю (UA / EN)"
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
    </div>
  );
};
