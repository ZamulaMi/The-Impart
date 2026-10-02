import React, { useState, useRef, useEffect } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Eye,
  EyeOff,
  Link as LinkIcon,
  Table as TableIcon,
  Image as ImageIcon,
  Video as VideoIcon,
  Highlighter,
  Palette,
  Type,
  Quote,
  AlertCircle,
  Info,
  CheckCircle2,
  AlertTriangle,
  List,
  ListOrdered,
  CheckSquare,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Minus,
  Upload,
  ChevronDown,
  Columns,
  Maximize2,
  Sparkles,
  HelpCircle,
  X,
  Check,
} from 'lucide-react';
import { ContentRenderer } from './ContentRenderer';

interface RichArticleEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  lang?: 'ua' | 'en';
  minHeight?: string;
}

export const RichArticleEditor: React.FC<RichArticleEditorProps> = ({
  value,
  onChange,
  placeholder = 'Напишіть текст статті тут...',
  lang = 'ua',
  minHeight = '360px',
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [viewMode, setViewMode] = useState<'edit' | 'split' | 'preview'>('edit');
  const [activeDropdown, setActiveDropdown] = useState<
    'heading' | 'highlight' | 'color' | 'font' | 'callout' | 'align' | null
  >(null);

  // Діалогові вікна
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkText, setLinkText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  const [showTableModal, setShowTableModal] = useState(false);
  const [tableCols, setTableCols] = useState(3);
  const [tableRows, setTableRows] = useState(2);
  const [tableHeaders, setTableHeaders] = useState(['Колонка 1', 'Колонка 2', 'Колонка 3']);

  const [showImageModal, setShowImageModal] = useState(false);
  const [imageTab, setImageTab] = useState<'upload' | 'url'>('upload');
  const [imageUrl, setImageUrl] = useState('');
  const [imageCaption, setImageCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [showVideoModal, setShowVideoModal] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');

  // Закриття випадаючих списків при кліку назовні
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.editor-dropdown-container')) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Оновлення кількості колонок у модалці таблиці
  useEffect(() => {
    setTableHeaders((prev) => {
      const updated = [...prev];
      while (updated.length < tableCols) {
        updated.push(`Колонка ${updated.length + 1}`);
      }
      return updated.slice(0, tableCols);
    });
  }, [tableCols]);

  // Підрахунок слів та орієнтовного часу читання
  const wordsCount = value.trim() ? value.trim().split(/\s+/).length : 0;
  const charsCount = value.length;
  const readTimeMinutes = Math.max(1, Math.ceil(wordsCount / 180));

  // Допоміжна функція для вставки тексту на місце курсора або виділення
  const insertText = (before: string, after: string = '', defaultInner: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentVal = textarea.value;
    const selectedText = currentVal.substring(start, end);
    const replacement = selectedText ? selectedText : defaultInner;

    const newVal =
      currentVal.substring(0, start) +
      before +
      replacement +
      after +
      currentVal.substring(end);

    onChange(newVal);

    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + before.length + replacement.length;
      textarea.setSelectionRange(
        start + before.length,
        newCursorPos
      );
    }, 10);
  };

  // Вставка на початку рядка (для списків і заголовків)
  const insertAtLineStart = (prefix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const currentVal = textarea.value;

    // Знаходимо початок поточного рядка
    const lineStart = currentVal.lastIndexOf('\n', start - 1) + 1;
    const beforeLine = currentVal.substring(0, lineStart);
    const afterLine = currentVal.substring(lineStart);

    // Якщо рядок вже має цей префікс — видаляємо його (toggle)
    if (afterLine.startsWith(prefix)) {
      const newVal = beforeLine + afterLine.substring(prefix.length);
      onChange(newVal);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start - prefix.length, start - prefix.length);
      }, 10);
    } else {
      const newVal = beforeLine + prefix + afterLine;
      onChange(newVal);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + prefix.length, start + prefix.length);
      }, 10);
    }
  };

  // Гарячі клавіші (Ctrl+B, Ctrl+I, Ctrl+U, Ctrl+K)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
      if (e.key === 'b' || e.key === 'B' || e.key === 'и' || e.key === 'И') {
        e.preventDefault();
        insertText('**', '**', 'жирний текст');
      } else if (e.key === 'i' || e.key === 'I' || e.key === 'ш' || e.key === 'Ш') {
        e.preventDefault();
        insertText('*', '*', 'курсив');
      } else if (e.key === 'u' || e.key === 'U' || e.key === 'г' || e.key === 'Г') {
        e.preventDefault();
        insertText('<u>', '</u>', 'підкреслений текст');
      } else if (e.key === 'k' || e.key === 'K' || e.key === 'л' || e.key === 'Л') {
        e.preventDefault();
        handleOpenLinkModal();
      }
    }
  };

  // Відкриття модалки посилання з автозаповненням виділеного тексту
  const handleOpenLinkModal = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selected = textarea.value.substring(start, end);
      setLinkText(selected || '');
      setLinkUrl('');
    }
    setShowLinkModal(true);
    setActiveDropdown(null);
  };

  // Застосування посилання
  const handleApplyLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkUrl.trim()) return;

    let cleanUrl = linkUrl.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://') && !cleanUrl.startsWith('/') && !cleanUrl.startsWith('mailto:')) {
      cleanUrl = `https://${cleanUrl}`;
    }

    const title = linkText.trim() || cleanUrl;
    insertText(`[${title}](${cleanUrl})`, '', '');
    setShowLinkModal(false);
  };

  // Вставка таблиці
  const handleInsertTable = (e: React.FormEvent) => {
    e.preventDefault();
    const headersStr = `| ${tableHeaders.join(' | ')} |`;
    const separatorStr = `| ${tableHeaders.map(() => '---').join(' | ')} |`;
    const rowsArr: string[] = [];

    for (let r = 1; r <= tableRows; r++) {
      const cells = tableHeaders.map((_, c) => `Дані ${r}.${c + 1}`);
      rowsArr.push(`| ${cells.join(' | ')} |`);
    }

    const tableMarkdown = `\n\n${headersStr}\n${separatorStr}\n${rowsArr.join('\n')}\n\n`;
    insertText(tableMarkdown);
    setShowTableModal(false);
  };

  // Оптимізація та конвертація завантаженого файлу зображення
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      // Стискаємо зображення через HTML Canvas для оптимізації розміру
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            // Обмежуємо максимальну ширину 1600px
            const maxDim = 1600;
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

            // Оптимізуємо в JPEG якість 0.85
            const optimized = canvas.toDataURL('image/jpeg', 0.85);
            resolve(optimized);
          };
          img.onerror = () => reject(new Error('Не вдалося завантажити зображення'));
          img.src = event.target?.result as string;
        };
        reader.onerror = () => reject(new Error('Помилка читання файлу'));
        reader.readAsDataURL(file);
      });

      // Спроба відправити на серверний ендпоінт для збереження на сервері
      let finalUrl = dataUrl;
      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: dataUrl,
            filename: file.name,
          }),
        });
        if (res.ok) {
          const result = await res.json();
          if (result.url) {
            finalUrl = result.url;
          }
        }
      } catch {
        // Якщо сервер недоступний — dataUrl все одно збережеться в статті та базі даних
      }

      setImageUrl(finalUrl);
    } catch (err: any) {
      setUploadError(err?.message || 'Помилка обробки файлу');
    } finally {
      setIsUploading(false);
    }
  };

  // Застосування вставки фото
  const handleApplyImage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageUrl.trim()) return;

    const cap = imageCaption.trim();
    const snippet = cap ? `\n\n![${cap}](${imageUrl.trim()})\n\n` : `\n\n![](${imageUrl.trim()})\n\n`;
    insertText(snippet);
    setShowImageModal(false);
    setImageUrl('');
    setImageCaption('');
    setUploadError(null);
  };

  // Вставка YouTube
  const handleApplyVideo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoUrl.trim()) return;
    insertText(`\n\n[video: ${videoUrl.trim()}]\n\n`);
    setShowVideoModal(false);
    setVideoUrl('');
  };

  return (
    <div className="border border-neutral-300 rounded-lg overflow-hidden bg-white shadow-xs focus-within:border-black transition-colors">
      {/* ПАНЕЛЬ ІНСТРУМЕНТІВ (TOOLBAR) */}
      <div className="bg-neutral-50/90 border-b border-neutral-200 p-2 sm:p-2.5 flex flex-wrap items-center justify-between gap-1.5 select-none text-neutral-700">
        <div className="flex flex-wrap items-center gap-1">
          {/* 1. РОЗМІР ТЕКСТУ (ЗАГОЛОВКИ) */}
          <div className="relative editor-dropdown-container">
            <button
              type="button"
              onClick={() => setActiveDropdown(activeDropdown === 'heading' ? null : 'heading')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-neutral-800 bg-white border border-neutral-200 rounded hover:bg-neutral-100 transition-colors cursor-pointer"
              title="Розмір тексту (Заголовки)"
            >
              <span>Заголовок</span>
              <ChevronDown className="w-3 h-3 text-neutral-500" />
            </button>

            {activeDropdown === 'heading' && (
              <div className="absolute top-full left-0 mt-1 z-30 w-44 bg-white border border-neutral-200 rounded-md shadow-lg py-1 animate-fade-in">
                <button
                  type="button"
                  onClick={() => {
                    insertAtLineStart('## ');
                    setActiveDropdown(null);
                  }}
                  className="w-full px-3 py-2 text-left text-sm font-bold hover:bg-neutral-100 flex items-center justify-between cursor-pointer"
                >
                  <span>Заголовок H1</span>
                  <span className="text-[10px] text-neutral-400 font-mono">##</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    insertAtLineStart('### ');
                    setActiveDropdown(null);
                  }}
                  className="w-full px-3 py-2 text-left text-sm font-semibold hover:bg-neutral-100 flex items-center justify-between cursor-pointer"
                >
                  <span>Заголовок H2</span>
                  <span className="text-[10px] text-neutral-400 font-mono">###</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    insertAtLineStart('#### ');
                    setActiveDropdown(null);
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-medium hover:bg-neutral-100 flex items-center justify-between cursor-pointer"
                >
                  <span>Підзаголовок H3</span>
                  <span className="text-[10px] text-neutral-400 font-mono">####</span>
                </button>
              </div>
            )}
          </div>

          <div className="h-4 w-px bg-neutral-200 mx-0.5" />

          {/* 2. БАЗОВЕ ФОРМАТУВАННЯ ТЕКСТУ (B, I, U, S, Code, Spoiler) */}
          <button
            type="button"
            onClick={() => insertText('**', '**', 'жирний текст')}
            className="p-1.5 text-neutral-700 hover:text-black hover:bg-neutral-200/70 rounded transition-colors cursor-pointer"
            title="Жирний (Ctrl+B)"
          >
            <Bold className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => insertText('*', '*', 'курсив')}
            className="p-1.5 text-neutral-700 hover:text-black hover:bg-neutral-200/70 rounded transition-colors cursor-pointer"
            title="Курсив (Ctrl+I)"
          >
            <Italic className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => insertText('<u>', '</u>', 'підкреслений')}
            className="p-1.5 text-neutral-700 hover:text-black hover:bg-neutral-200/70 rounded transition-colors cursor-pointer"
            title="Підкреслений (Ctrl+U)"
          >
            <Underline className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => insertText('~~', '~~', 'закреслений')}
            className="p-1.5 text-neutral-700 hover:text-black hover:bg-neutral-200/70 rounded transition-colors cursor-pointer"
            title="Закреслений"
          >
            <Strikethrough className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => insertText('`', '`', 'код')}
            className="p-1.5 text-neutral-700 hover:text-black hover:bg-neutral-200/70 rounded transition-colors cursor-pointer"
            title="Моноширинний / Код"
          >
            <Code className="w-4 h-4" />
          </button>

          {/* TELEGRAM SPOILER (Прихований текст) */}
          <button
            type="button"
            onClick={() => insertText('||', '||', 'прихований текст')}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-neutral-800 bg-neutral-200/60 hover:bg-neutral-300/80 rounded transition-colors cursor-pointer"
            title="Прихований текст / Спойлер (як у Telegram)"
          >
            <EyeOff className="w-3.5 h-3.5 text-neutral-600" />
            <span className="hidden sm:inline">Спойлер</span>
          </button>

          <div className="h-4 w-px bg-neutral-200 mx-0.5" />

          {/* 3. ХАЙЛАЙТЕР (ВИДІЛЕННЯ МАРКЕРОМ) */}
          <div className="relative editor-dropdown-container">
            <button
              type="button"
              onClick={() => setActiveDropdown(activeDropdown === 'highlight' ? null : 'highlight')}
              className="p-1.5 text-neutral-700 hover:text-black hover:bg-neutral-200/70 rounded transition-colors cursor-pointer flex items-center gap-0.5"
              title="Виділення маркером (Хайлайтер)"
            >
              <Highlighter className="w-4 h-4 text-amber-500" />
              <ChevronDown className="w-2.5 h-2.5 text-neutral-400" />
            </button>

            {activeDropdown === 'highlight' && (
              <div className="absolute top-full left-0 mt-1 z-30 w-44 bg-white border border-neutral-200 rounded-md shadow-lg p-2 animate-fade-in space-y-1">
                <div className="text-[10px] uppercase font-bold text-neutral-400 px-1 mb-1">
                  Колір маркера
                </div>
                {[
                  { id: 'yellow', label: 'Жовтий маркер', bg: 'bg-yellow-200' },
                  { id: 'green', label: 'Зелений маркер', bg: 'bg-emerald-200' },
                  { id: 'blue', label: 'Блакитний маркер', bg: 'bg-sky-200' },
                  { id: 'pink', label: 'Рожевий маркер', bg: 'bg-pink-200' },
                  { id: 'orange', label: 'Помаранчевий', bg: 'bg-amber-200' },
                  { id: 'purple', label: 'Фіолетовий', bg: 'bg-purple-200' },
                ].map((color) => (
                  <button
                    key={color.id}
                    type="button"
                    onClick={() => {
                      insertText(`[hl:${color.id}]`, `[/hl]`, 'виділений текст');
                      setActiveDropdown(null);
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1 text-xs rounded hover:bg-neutral-100 cursor-pointer text-left"
                  >
                    <span className={`w-3.5 h-3.5 rounded-full ${color.bg} border border-neutral-300`} />
                    <span>{color.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 4. КОЛІР ТЕКСТУ */}
          <div className="relative editor-dropdown-container">
            <button
              type="button"
              onClick={() => setActiveDropdown(activeDropdown === 'color' ? null : 'color')}
              className="p-1.5 text-neutral-700 hover:text-black hover:bg-neutral-200/70 rounded transition-colors cursor-pointer flex items-center gap-0.5"
              title="Зміна кольору тексту"
            >
              <Palette className="w-4 h-4 text-rose-500" />
              <ChevronDown className="w-2.5 h-2.5 text-neutral-400" />
            </button>

            {activeDropdown === 'color' && (
              <div className="absolute top-full left-0 mt-1 z-30 w-44 bg-white border border-neutral-200 rounded-md shadow-lg p-2 animate-fade-in space-y-1">
                <div className="text-[10px] uppercase font-bold text-neutral-400 px-1 mb-1">
                  Колір шрифту
                </div>
                {[
                  { hex: '#dc2626', label: 'Червоний', dot: 'bg-red-600' },
                  { hex: '#2563eb', label: 'Синій', dot: 'bg-blue-600' },
                  { hex: '#16a34a', label: 'Зелений', dot: 'bg-emerald-600' },
                  { hex: '#d97706', label: 'Бурштиновий', dot: 'bg-amber-600' },
                  { hex: '#9333ea', label: 'Фіолетовий', dot: 'bg-purple-600' },
                  { hex: '#6b7280', label: 'Світло-сірий', dot: 'bg-neutral-500' },
                ].map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => {
                      insertText(`[color:${c.hex}]`, `[/color]`, 'кольоровий текст');
                      setActiveDropdown(null);
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1 text-xs rounded hover:bg-neutral-100 cursor-pointer text-left"
                  >
                    <span className={`w-3.5 h-3.5 rounded-full ${c.dot}`} />
                    <span style={{ color: c.hex }} className="font-medium">
                      {c.label}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 5. ШРИФТ (FONT FAMILY) */}
          <div className="relative editor-dropdown-container">
            <button
              type="button"
              onClick={() => setActiveDropdown(activeDropdown === 'font' ? null : 'font')}
              className="p-1.5 text-neutral-700 hover:text-black hover:bg-neutral-200/70 rounded transition-colors cursor-pointer flex items-center gap-0.5"
              title="Вибір стилю шрифту"
            >
              <Type className="w-4 h-4 text-neutral-700" />
              <ChevronDown className="w-2.5 h-2.5 text-neutral-400" />
            </button>

            {activeDropdown === 'font' && (
              <div className="absolute top-full left-0 mt-1 z-30 w-48 bg-white border border-neutral-200 rounded-md shadow-lg p-1.5 animate-fade-in space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    insertText('[font:serif]', '[/font]', 'Текст шрифтом Serif');
                    setActiveDropdown(null);
                  }}
                  className="w-full px-2.5 py-1.5 text-left text-sm font-serif hover:bg-neutral-100 rounded cursor-pointer"
                >
                  Класичний Serif (із зарубками)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    insertText('[font:sans]', '[/font]', 'Текст шрифтом Sans-serif');
                    setActiveDropdown(null);
                  }}
                  className="w-full px-2.5 py-1.5 text-left text-sm font-sans hover:bg-neutral-100 rounded cursor-pointer"
                >
                  Сучасний Sans (гротеск)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    insertText('[font:mono]', '[/font]', 'Текст шрифтом Monospace');
                    setActiveDropdown(null);
                  }}
                  className="w-full px-2.5 py-1.5 text-left text-xs font-mono hover:bg-neutral-100 rounded cursor-pointer"
                >
                  Друкарська машинка (Mono)
                </button>
              </div>
            )}
          </div>

          <div className="h-4 w-px bg-neutral-200 mx-0.5" />

          {/* 6. СПИСКИ ТА ВИРІВНЮВАННЯ */}
          <button
            type="button"
            onClick={() => insertAtLineStart('- ')}
            className="p-1.5 text-neutral-700 hover:text-black hover:bg-neutral-200/70 rounded transition-colors cursor-pointer"
            title="Маркований список"
          >
            <List className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => insertAtLineStart('1. ')}
            className="p-1.5 text-neutral-700 hover:text-black hover:bg-neutral-200/70 rounded transition-colors cursor-pointer"
            title="Нумерований список"
          >
            <ListOrdered className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => insertAtLineStart('- [ ] ')}
            className="p-1.5 text-neutral-700 hover:text-black hover:bg-neutral-200/70 rounded transition-colors cursor-pointer"
            title="Чек-лист (завдання)"
          >
            <CheckSquare className="w-4 h-4 text-emerald-600" />
          </button>

          <div className="h-4 w-px bg-neutral-200 mx-0.5" />

          {/* 7. КОЛЬОРОВІ БЛОКИ ТА ЦИТАТИ (CALLOUTS) */}
          <div className="relative editor-dropdown-container">
            <button
              type="button"
              onClick={() => setActiveDropdown(activeDropdown === 'callout' ? null : 'callout')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-neutral-800 bg-white border border-neutral-200 rounded hover:bg-neutral-100 transition-colors cursor-pointer"
              title="Кольорові блоки тексту та цитати"
            >
              <Quote className="w-3.5 h-3.5 text-neutral-600" />
              <span>Блоки / Цитати</span>
              <ChevronDown className="w-3 h-3 text-neutral-400" />
            </button>

            {activeDropdown === 'callout' && (
              <div className="absolute top-full left-0 mt-1 z-30 w-56 bg-white border border-neutral-200 rounded-md shadow-lg p-1.5 animate-fade-in space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    insertText('> ', '', 'Текст редакційної цитати...');
                    setActiveDropdown(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-neutral-100 rounded text-left cursor-pointer"
                >
                  <Quote className="w-4 h-4 text-neutral-500" />
                  <span>Класична цитата з лінією</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    insertText('[callout:info title="До відома"]\n', '\n[/callout]', 'Важлива інформаційна довідка...');
                    setActiveDropdown(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-sky-800 hover:bg-sky-50 rounded text-left cursor-pointer"
                >
                  <Info className="w-4 h-4 text-sky-600" />
                  <span>Інформаційний блок (Синій)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    insertText('[callout:warning title="Зверніть увагу"]\n', '\n[/callout]', 'Застереження або важлива примітка...');
                    setActiveDropdown(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-amber-800 hover:bg-amber-50 rounded text-left cursor-pointer"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Попередження (Жовтий)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    insertText('[callout:success title="Висновок"]\n', '\n[/callout]', 'Ключовий висновок чи успіх...');
                    setActiveDropdown(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-emerald-800 hover:bg-emerald-50 rounded text-left cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Успіх / Висновок (Зелений)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    insertText('[callout:danger title="Важливо"]\n', '\n[/callout]', 'Термінова або критична інформація...');
                    setActiveDropdown(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-red-800 hover:bg-red-50 rounded text-left cursor-pointer"
                >
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <span>Увага / Критично (Червоний)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    insertText('[callout:dark title="Коментар"]\n', '\n[/callout]', 'Стильний чорний блок...');
                    setActiveDropdown(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-neutral-900 hover:bg-neutral-100 rounded text-left cursor-pointer"
                >
                  <span className="w-3.5 h-3.5 rounded bg-black inline-block" />
                  <span>Темний акцентний блок</span>
                </button>
              </div>
            )}
          </div>

          <div className="h-4 w-px bg-neutral-200 mx-0.5" />

          {/* 8. ВСТАВКА МЕДІА, ТАБЛИЦЬ, ПОСИЛАНЬ */}
          <button
            type="button"
            onClick={handleOpenLinkModal}
            className="p-1.5 text-neutral-700 hover:text-black hover:bg-neutral-200/70 rounded transition-colors cursor-pointer"
            title="Зробити виділений текст посиланням (Ctrl+K)"
          >
            <LinkIcon className="w-4 h-4 text-blue-600" />
          </button>

          <button
            type="button"
            onClick={() => setShowTableModal(true)}
            className="p-1.5 text-neutral-700 hover:text-black hover:bg-neutral-200/70 rounded transition-colors cursor-pointer"
            title="Створити таблицю"
          >
            <TableIcon className="w-4 h-4 text-emerald-600" />
          </button>

          <button
            type="button"
            onClick={() => setShowImageModal(true)}
            className="p-1.5 text-neutral-700 hover:text-black hover:bg-neutral-200/70 rounded transition-colors cursor-pointer"
            title="Вставити фото (завантажити файл або URL)"
          >
            <ImageIcon className="w-4 h-4 text-neutral-700" />
          </button>

          <button
            type="button"
            onClick={() => setShowVideoModal(true)}
            className="p-1.5 text-neutral-700 hover:text-black hover:bg-neutral-200/70 rounded transition-colors cursor-pointer"
            title="Вставити YouTube відео"
          >
            <VideoIcon className="w-4 h-4 text-red-600" />
          </button>

          <button
            type="button"
            onClick={() => insertText('\n\n---\n\n')}
            className="p-1.5 text-neutral-700 hover:text-black hover:bg-neutral-200/70 rounded transition-colors cursor-pointer"
            title="Розділювач рядків"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>

        {/* ПЕРЕМИКАЧ РЕЖИМІВ (EDIT / SPLIT / PREVIEW) */}
        <div className="flex items-center gap-1.5 border border-neutral-200 bg-white rounded p-0.5 shrink-0 ml-auto">
          <button
            type="button"
            onClick={() => setViewMode('edit')}
            className={`px-2.5 py-1 text-xs rounded transition-colors cursor-pointer font-medium ${
              viewMode === 'edit'
                ? 'bg-black text-white'
                : 'text-neutral-600 hover:text-black'
            }`}
          >
            Текст
          </button>
          <button
            type="button"
            onClick={() => setViewMode('split')}
            className={`hidden md:inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded transition-colors cursor-pointer font-medium ${
              viewMode === 'split'
                ? 'bg-black text-white'
                : 'text-neutral-600 hover:text-black'
            }`}
            title="Паралельний режим редактора та живого прев'ю"
          >
            <Columns className="w-3 h-3" />
            <span>Паралельно</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('preview')}
            className={`px-2.5 py-1 text-xs rounded transition-colors cursor-pointer font-medium ${
              viewMode === 'preview'
                ? 'bg-black text-white'
                : 'text-neutral-600 hover:text-black'
            }`}
          >
            Прев'ю
          </button>
        </div>
      </div>

      {/* РОБОЧА ЗОНА РЕДАКТОРА */}
      <div className="relative">
        {viewMode === 'edit' && (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            style={{ minHeight }}
            className="w-full p-4 sm:p-5 text-sm sm:text-base leading-relaxed font-serif text-neutral-900 focus:outline-none resize-y border-0 bg-white"
          />
        )}

        {viewMode === 'split' && (
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-neutral-200">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              style={{ minHeight }}
              className="w-full p-4 text-sm font-serif leading-relaxed text-neutral-900 focus:outline-none resize-y border-0 bg-white"
            />
            <div
              style={{ minHeight }}
              className="p-5 overflow-y-auto bg-neutral-50/50 max-h-[600px]"
            >
              <div className="text-[11px] font-sans uppercase tracking-wider text-neutral-400 font-semibold mb-4 pb-1 border-b border-neutral-200">
                Живий попередній перегляд
              </div>
              <ContentRenderer content={value} />
            </div>
          </div>
        )}

        {viewMode === 'preview' && (
          <div
            style={{ minHeight }}
            className="p-6 sm:p-8 bg-neutral-50/40 overflow-y-auto"
          >
            <ContentRenderer content={value} />
          </div>
        )}
      </div>

      {/* НИЖНІЙ СТАТУСНИЙ РЯДОК */}
      <div className="bg-neutral-50 border-t border-neutral-200 px-4 py-2 flex flex-wrap items-center justify-between text-xs text-neutral-500 font-sans">
        <div className="flex items-center gap-3">
          <span>Слів: <strong className="text-neutral-700">{wordsCount}</strong></span>
          <span>·</span>
          <span>Символів: <strong className="text-neutral-700">{charsCount}</strong></span>
          <span>·</span>
          <span>Час читання: <strong className="text-neutral-700">~{readTimeMinutes} хв</strong></span>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-[11px] text-neutral-400">
          <span>Підказки: <strong>Ctrl+B</strong> жирний, <strong>Ctrl+I</strong> курсив, <strong>Ctrl+K</strong> посилання</span>
        </div>
      </div>

      {/* МОДАЛЬНЕ ВІКНО ПОСИЛАННЯ */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 border border-neutral-200"
          >
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 mb-4">
              <h3 className="font-semibold text-sm uppercase tracking-wider text-black flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-blue-600" />
                <span>Зробити текст посиланням</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowLinkModal(false)}
                className="text-neutral-400 hover:text-black cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleApplyLink} className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">
                  Текст посилання (назва) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="напр. Читайте детальніше в Telegram"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  className="w-full text-sm border border-neutral-300 rounded px-3 py-2 focus:border-black focus:outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">
                  URL адреса посилання *
                </label>
                <input
                  type="text"
                  required
                  placeholder="https://t.me/the_impart або https://example.com"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  className="w-full text-sm border border-neutral-300 rounded px-3 py-2 focus:border-black focus:outline-none font-mono text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setShowLinkModal(false)}
                  className="px-4 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-100 rounded cursor-pointer"
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium bg-black text-white rounded hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  Вставити посилання
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* МОДАЛЬНЕ ВІКНО ТАБЛИЦІ */}
      {showTableModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 border border-neutral-200"
          >
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 mb-4">
              <h3 className="font-semibold text-sm uppercase tracking-wider text-black flex items-center gap-2">
                <TableIcon className="w-4 h-4 text-emerald-600" />
                <span>Конструктор таблиці</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowTableModal(false)}
                className="text-neutral-400 hover:text-black cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleInsertTable} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">
                    Кількість колонок
                  </label>
                  <select
                    value={tableCols}
                    onChange={(e) => setTableCols(Number(e.target.value))}
                    className="w-full text-sm border border-neutral-300 rounded px-3 py-2 focus:border-black focus:outline-none"
                  >
                    {[2, 3, 4, 5, 6].map((num) => (
                      <option key={num} value={num}>
                        {num} колонки
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">
                    Кількість рядків даних
                  </label>
                  <select
                    value={tableRows}
                    onChange={(e) => setTableRows(Number(e.target.value))}
                    className="w-full text-sm border border-neutral-300 rounded px-3 py-2 focus:border-black focus:outline-none"
                  >
                    {[1, 2, 3, 4, 5, 6, 8, 10].map((num) => (
                      <option key={num} value={num}>
                        {num} рядків
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-2">
                  Заголовки колонок таблиці
                </label>
                <div className="space-y-2">
                  {tableHeaders.map((header, idx) => (
                    <input
                      key={idx}
                      type="text"
                      required
                      placeholder={`Заголовок колонки ${idx + 1}`}
                      value={header}
                      onChange={(e) => {
                        const updated = [...tableHeaders];
                        updated[idx] = e.target.value;
                        setTableHeaders(updated);
                      }}
                      className="w-full text-sm border border-neutral-300 rounded px-3 py-1.5 focus:border-black focus:outline-none"
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setShowTableModal(false)}
                  className="px-4 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-100 rounded cursor-pointer"
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium bg-black text-white rounded hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  Вставити таблицю
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* МОДАЛЬНЕ ВІКНО ЗОБРАЖЕННЯ (UPLOAD + URL) */}
      {showImageModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 border border-neutral-200"
          >
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 mb-4">
              <h3 className="font-semibold text-sm uppercase tracking-wider text-black flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-neutral-700" />
                <span>Вставити зображення у статтю</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowImageModal(false)}
                className="text-neutral-400 hover:text-black cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Вкладки: Завантажити файл або Посилання */}
            <div className="flex items-center border-b border-neutral-200 mb-4">
              <button
                type="button"
                onClick={() => setImageTab('upload')}
                className={`flex-1 py-2 text-xs font-medium text-center border-b-2 transition-colors cursor-pointer ${
                  imageTab === 'upload'
                    ? 'border-black text-black font-semibold'
                    : 'border-transparent text-neutral-500 hover:text-black'
                }`}
              >
                Завантажити файл з комп'ютера
              </button>
              <button
                type="button"
                onClick={() => setImageTab('url')}
                className={`flex-1 py-2 text-xs font-medium text-center border-b-2 transition-colors cursor-pointer ${
                  imageTab === 'url'
                    ? 'border-black text-black font-semibold'
                    : 'border-transparent text-neutral-500 hover:text-black'
                }`}
              >
                Вказати посилання (URL)
              </button>
            </div>

            <form onSubmit={handleApplyImage} className="space-y-4">
              {imageTab === 'upload' ? (
                <div>
                  <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">
                    Виберіть файл фотографії *
                  </label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-neutral-300 hover:border-black rounded-lg p-6 text-center cursor-pointer transition-colors bg-neutral-50/50 hover:bg-neutral-50"
                  >
                    <Upload className="w-6 h-6 mx-auto text-neutral-400 mb-2" />
                    <div className="text-xs font-medium text-neutral-800">
                      {isUploading ? 'Обробка зображення...' : 'Натисніть або перетягніть файл сюди'}
                    </div>
                    <div className="text-[11px] text-neutral-400 mt-1">
                      Підтримуються PNG, JPG, WEBP, GIF (зберігається на сервері)
                    </div>
                  </div>

                  {uploadError && (
                    <div className="text-xs text-red-600 mt-2">{uploadError}</div>
                  )}

                  {imageUrl && (
                    <div className="mt-3 p-2 bg-neutral-100 rounded flex items-center gap-3">
                      <img src={imageUrl} alt="Прев'ю" className="w-12 h-12 object-cover rounded border border-neutral-300" />
                      <div className="text-xs text-neutral-700 truncate flex-1">
                        ✓ Зображення готове до вставки
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">
                    URL посилання на зображення *
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="https://images.unsplash.com/... або пряме посилання"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="w-full text-sm border border-neutral-300 rounded px-3 py-2 focus:border-black focus:outline-none font-mono text-xs"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">
                  Підпис до зображення (необов'язково)
                </label>
                <input
                  type="text"
                  placeholder="напр. Фото: Reuters / Джерело"
                  value={imageCaption}
                  onChange={(e) => setImageCaption(e.target.value)}
                  className="w-full text-sm border border-neutral-300 rounded px-3 py-2 focus:border-black focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setShowImageModal(false)}
                  className="px-4 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-100 rounded cursor-pointer"
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  disabled={!imageUrl || isUploading}
                  className="px-4 py-2 text-xs font-medium bg-black text-white rounded hover:bg-neutral-800 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Вставити фото
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* МОДАЛЬНЕ ВІКНО YOUTUBE */}
      {showVideoModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 border border-neutral-200"
          >
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 mb-4">
              <h3 className="font-semibold text-sm uppercase tracking-wider text-black flex items-center gap-2">
                <VideoIcon className="w-4 h-4 text-red-600" />
                <span>Вставити відео з YouTube</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowVideoModal(false)}
                className="text-neutral-400 hover:text-black cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleApplyVideo} className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">
                  Посилання на відео (YouTube URL) *
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://www.youtube.com/watch?v=... або https://youtu.be/..."
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  className="w-full text-sm border border-neutral-300 rounded px-3 py-2 focus:border-black focus:outline-none font-mono text-xs"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setShowVideoModal(false)}
                  className="px-4 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-100 rounded cursor-pointer"
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium bg-red-600 text-white rounded hover:bg-red-700 transition-colors cursor-pointer"
                >
                  Вставити відео
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
