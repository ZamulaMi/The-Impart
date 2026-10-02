import React, { useState } from 'react';
import {
  Info,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Quote as QuoteIcon,
  ExternalLink,
  CheckSquare,
  Square,
  ZoomIn,
  X,
  Eye,
  EyeOff,
} from 'lucide-react';

interface ContentRendererProps {
  content: string;
}

// Видобування YouTube Video ID
export function getYouTubeId(url: string): string | null {
  const clean = url.trim();
  const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
  const match = clean.match(regExp);
  return match ? match[1] : null;
}

// Перевірка на посилання або data-uri зображення
export function isImageUrl(url: string): boolean {
  const clean = url.trim();
  if (clean.startsWith('data:image/')) return true;
  if (/^https?:\/\/.*\.(?:jpg|jpeg|png|webp|gif|svg|avif)(?:[?#].*)?$/i.test(clean)) return true;
  if (/^https?:\/\/images\.unsplash\.com\/.+/i.test(clean)) return true;
  if (clean.startsWith('/uploads/')) return true;
  return false;
}

// Telegram-style Spoiler компонент
const Spoiler: React.FC<{ text: string }> = ({ text }) => {
  const [revealed, setRevealed] = useState(false);

  return (
    <span
      onClick={() => setRevealed(!revealed)}
      title={revealed ? 'Приховати спойлер' : 'Натисніть, щоб переглянути прихований текст'}
      className={`relative inline-block cursor-pointer select-none rounded px-1.5 py-0.5 transition-all duration-200 ${
        revealed
          ? 'bg-neutral-100 text-neutral-900 border border-neutral-300'
          : 'bg-neutral-800 text-transparent hover:bg-neutral-700 blur-[2px] hover:blur-[1px]'
      }`}
      style={{
        textShadow: revealed ? 'none' : '0 0 8px rgba(0,0,0,0.5)',
      }}
    >
      <span className={revealed ? '' : 'opacity-0 select-none'}>{text}</span>
      {!revealed && (
        <span className="absolute inset-0 flex items-center justify-center text-[10px] text-white/80 font-mono tracking-widest uppercase">
          spoiler
        </span>
      )}
    </span>
  );
};

// Рендерер інлайн-форматування (Bold, Italic, Strikethrough, Underline, Code, Spoiler, Highlighter, Colors, Fonts, Links)
export const renderInlineFormatting = (text: string): React.ReactNode => {
  if (!text) return null;

  // Токенізація через регулярний вираз для підтримки комбінованого форматування
  // Паттерни:
  // 1. Spoilers: ||spoiler||
  // 2. Highlighters: [hl:color]text[/hl] or ==text==
  // 3. Colors: [color:code]text[/color]
  // 4. Fonts: [font:type]text[/font]
  // 5. Links: [label](url)
  // 6. Bold: **text** or <b>text</b>
  // 7. Italic: *text* or <i>text</i>
  // 8. Strikethrough: ~~text~~
  // 9. Underline: <u>text</u>
  // 10. Code: `code`

  const regex =
    /(\|\|[\s\S]*?\|\||\[hl:([a-z0-9#-]+)\][\s\S]*?\[\/hl\]|==[\s\S]*?==|\[color:([#a-zA-Z0-9]+)\][\s\S]*?\[\/color\]|\[font:(serif|sans|mono)\][\s\S]*?\[\/font\]|\[(.*?)\]\((https?:\/\/[^\s)]+|\/[^\s)]+|mailto:[^\s)]+|tel:[^\s)]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|(?<!\*)\*([^*]+)\*(?!\*)|~~([^~]+)~~|<u>(.*?)<\/u>|`([^`]+)`)/g;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const fullMatch = match[0];
    const matchIndex = match.index;

    if (matchIndex > lastIndex) {
      parts.push(text.slice(lastIndex, matchIndex));
    }

    const key = `inline_${matchIndex}_${fullMatch.slice(0, 8)}`;

    // 1. Telegram-style Spoiler: ||text||
    if (fullMatch.startsWith('||') && fullMatch.endsWith('||')) {
      const inner = fullMatch.slice(2, -2);
      parts.push(<Spoiler key={key} text={inner} />);
    }
    // 2. Highlighter: [hl:color]text[/hl]
    else if (fullMatch.startsWith('[hl:') && fullMatch.endsWith('[/hl]')) {
      const colorMatch = fullMatch.match(/^\[hl:([a-z0-9#-]+)\]([\s\S]*?)\[\/hl\]$/);
      if (colorMatch) {
        const colorName = colorMatch[1];
        const inner = colorMatch[2];
        const bgClasses: Record<string, string> = {
          yellow: 'bg-yellow-200 text-neutral-900',
          green: 'bg-emerald-200 text-neutral-900',
          blue: 'bg-sky-200 text-neutral-900',
          pink: 'bg-pink-200 text-neutral-900',
          orange: 'bg-amber-200 text-neutral-900',
          purple: 'bg-purple-200 text-neutral-900',
        };
        const cls = bgClasses[colorName] || 'bg-yellow-200 text-neutral-900';
        parts.push(
          <mark key={key} className={`${cls} px-1.5 py-0.5 rounded-sm font-inherit`}>
            {renderInlineFormatting(inner)}
          </mark>
        );
      }
    }
    // 3. Highlighter: ==text==
    else if (fullMatch.startsWith('==') && fullMatch.endsWith('==')) {
      const inner = fullMatch.slice(2, -2);
      parts.push(
        <mark key={key} className="bg-yellow-200 text-neutral-900 px-1.5 py-0.5 rounded-sm font-inherit">
          {renderInlineFormatting(inner)}
        </mark>
      );
    }
    // 4. Color: [color:#hex]text[/color]
    else if (fullMatch.startsWith('[color:') && fullMatch.endsWith('[/color]')) {
      const colorMatch = fullMatch.match(/^\[color:([#a-zA-Z0-9]+)\]([\s\S]*?)\[\/color\]$/);
      if (colorMatch) {
        const colorVal = colorMatch[1];
        const inner = colorMatch[2];
        parts.push(
          <span key={key} style={{ color: colorVal }}>
            {renderInlineFormatting(inner)}
          </span>
        );
      }
    }
    // 5. Font: [font:serif|sans|mono]text[/font]
    else if (fullMatch.startsWith('[font:') && fullMatch.endsWith('[/font]')) {
      const fontMatch = fullMatch.match(/^\[font:(serif|sans|mono)\]([\s\S]*?)\[\/font\]$/);
      if (fontMatch) {
        const fontType = fontMatch[1];
        const inner = fontMatch[2];
        const fontCls =
          fontType === 'serif'
            ? 'font-serif'
            : fontType === 'mono'
            ? 'font-mono text-[0.9em]'
            : 'font-sans';
        parts.push(
          <span key={key} className={fontCls}>
            {renderInlineFormatting(inner)}
          </span>
        );
      }
    }
    // 6. Link: [label](url)
    else if (fullMatch.startsWith('[') && fullMatch.includes('](')) {
      const linkMatch = fullMatch.match(/^\[(.*?)\]\((.*?)\)$/);
      if (linkMatch) {
        const label = linkMatch[1];
        const url = linkMatch[2];
        const isExternal = url.startsWith('http://') || url.startsWith('https://');
        parts.push(
          <a
            key={key}
            href={url}
            target={isExternal ? '_blank' : undefined}
            rel={isExternal ? 'noopener noreferrer' : undefined}
            className="inline-flex items-baseline gap-1 text-black font-medium underline underline-offset-4 decoration-neutral-400 hover:decoration-black hover:text-neutral-900 transition-colors cursor-pointer"
          >
            <span>{renderInlineFormatting(label)}</span>
            {isExternal && <ExternalLink className="w-3 h-3 self-center text-neutral-400 inline" />}
          </a>
        );
      }
    }
    // 7. Bold: **text**
    else if (fullMatch.startsWith('**') && fullMatch.endsWith('**')) {
      parts.push(
        <strong key={key} className="font-bold text-neutral-950">
          {renderInlineFormatting(fullMatch.slice(2, -2))}
        </strong>
      );
    }
    // 8. Italic: *text*
    else if (fullMatch.startsWith('*') && fullMatch.endsWith('*')) {
      parts.push(
        <em key={key} className="italic font-serif">
          {renderInlineFormatting(fullMatch.slice(1, -1))}
        </em>
      );
    }
    // 9. Strikethrough: ~~text~~
    else if (fullMatch.startsWith('~~') && fullMatch.endsWith('~~')) {
      parts.push(
        <s key={key} className="line-through text-neutral-500">
          {renderInlineFormatting(fullMatch.slice(2, -2))}
        </s>
      );
    }
    // 10. Underline: <u>text</u>
    else if (fullMatch.startsWith('<u>') && fullMatch.endsWith('</u>')) {
      parts.push(
        <u key={key} className="underline underline-offset-4 decoration-neutral-500">
          {renderInlineFormatting(fullMatch.slice(3, -4))}
        </u>
      );
    }
    // 11. Code: `code`
    else if (fullMatch.startsWith('`') && fullMatch.endsWith('`')) {
      parts.push(
        <code
          key={key}
          className="font-mono text-[0.85em] bg-neutral-100 text-neutral-800 border border-neutral-200 rounded px-1.5 py-0.5"
        >
          {fullMatch.slice(1, -1)}
        </code>
      );
    } else {
      parts.push(fullMatch);
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
};

// Типи блоків документа
type ParsedBlock =
  | { type: 'youtube'; videoId: string; url: string }
  | { type: 'image'; src: string; caption?: string }
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | {
      type: 'callout';
      variant: 'info' | 'warning' | 'success' | 'danger' | 'quote' | 'dark';
      title?: string;
      content: string;
    }
  | { type: 'quote'; text: string; author?: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'checklist'; items: { checked: boolean; text: string }[] }
  | { type: 'divider' }
  | { type: 'paragraph'; text: string; align?: 'left' | 'center' | 'right' };

export const ContentRenderer: React.FC<ContentRendererProps> = ({ content }) => {
  const [lightboxImg, setLightboxImg] = useState<{ src: string; caption?: string } | null>(null);

  if (!content) return null;

  // Розбиваємо весь текст на секції/абзаци
  const rawSections = content.split(/\n\s*\n/);
  const blocks: ParsedBlock[] = [];

  for (const rawSec of rawSections) {
    const trimmed = rawSec.trim();
    if (!trimmed) continue;

    // 1. Розділювач: ---
    if (/^---{1,}$/.test(trimmed)) {
      blocks.push({ type: 'divider' });
      continue;
    }

    // 2. YouTube тег або URL: [video: URL] або [youtube: URL]
    const videoTagMatch = trimmed.match(/^\[(?:video|youtube):\s*(https?:\/\/[^\s\]]+)\]$/i);
    if (videoTagMatch) {
      const vid = getYouTubeId(videoTagMatch[1]);
      if (vid) {
        blocks.push({ type: 'youtube', videoId: vid, url: videoTagMatch[1] });
        continue;
      }
    }

    // 3. YouTube як окремий URL
    const singleYtId = getYouTubeId(trimmed);
    if (
      singleYtId &&
      (trimmed.startsWith('http://') || trimmed.startsWith('https://')) &&
      !trimmed.includes(' ') &&
      !trimmed.includes('\n')
    ) {
      blocks.push({ type: 'youtube', videoId: singleYtId, url: trimmed });
      continue;
    }

    // 4. Markdown зображення: ![caption](src)
    const mdImgMatch = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (mdImgMatch) {
      blocks.push({
        type: 'image',
        src: mdImgMatch[2],
        caption: mdImgMatch[1] || undefined,
      });
      continue;
    }

    // 5. Тег фото: [photo: URL "caption"]
    const photoTagMatch = trimmed.match(
      /^\[(?:photo|image|img):\s*([^\s\]]+)(?:\s+"(.*?)")?\]$/i
    );
    if (photoTagMatch) {
      blocks.push({
        type: 'image',
        src: photoTagMatch[1],
        caption: photoTagMatch[2] || undefined,
      });
      continue;
    }

    // 6. Окреме посилання на зображення без тегів
    if (isImageUrl(trimmed) && !trimmed.includes(' ') && !trimmed.includes('\n')) {
      blocks.push({ type: 'image', src: trimmed });
      continue;
    }

    // 7. Callout блок: [callout:variant title="..."]content[/callout]
    const calloutMatch = trimmed.match(
      /^\[callout:(info|warning|success|danger|quote|dark)(?:\s+title="(.*?)")?\]([\s\S]*?)\[\/callout\]$/i
    );
    if (calloutMatch) {
      blocks.push({
        type: 'callout',
        variant: calloutMatch[1].toLowerCase() as any,
        title: calloutMatch[2] || undefined,
        content: calloutMatch[3].trim(),
      });
      continue;
    }

    // 8. Markdown таблиця:
    // | H1 | H2 |
    // |---|---|
    // | R1 | R2 |
    if (trimmed.startsWith('|') && trimmed.includes('\n') && trimmed.includes('|---|')) {
      const tableLines = trimmed
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.startsWith('|') && l.endsWith('|'));
      if (tableLines.length >= 2) {
        const parseRow = (line: string) =>
          line
            .slice(1, -1)
            .split('|')
            .map((c) => c.trim());

        const headers = parseRow(tableLines[0]);
        // Рядок 1 — роздільник (|---|---|), пропускаємо його
        const dataRows = tableLines.slice(2).map(parseRow);

        blocks.push({
          type: 'table',
          headers,
          rows: dataRows,
        });
        continue;
      }
    }

    // 9. Заголовки H1 (## ), H2 (### ), H3 (#### )
    const h1Match = trimmed.match(/^##\s+(.+)$/);
    if (h1Match) {
      blocks.push({ type: 'heading', level: 1, text: h1Match[1] });
      continue;
    }
    const h2Match = trimmed.match(/^###\s+(.+)$/);
    if (h2Match) {
      blocks.push({ type: 'heading', level: 2, text: h2Match[1] });
      continue;
    }
    const h3Match = trimmed.match(/^####\s+(.+)$/);
    if (h3Match) {
      blocks.push({ type: 'heading', level: 3, text: h3Match[1] });
      continue;
    }

    // 10. Блок цитати: > text
    if (trimmed.startsWith('>')) {
      const quoteLines = trimmed
        .split('\n')
        .map((l) => l.replace(/^>\s?/, '').trim())
        .join(' ');
      blocks.push({ type: 'quote', text: quoteLines });
      continue;
    }

    // 11. Чек-лист (завдання): - [ ] чи - [x]
    if (trimmed.startsWith('- [ ]') || trimmed.startsWith('- [x]')) {
      const checkItems = trimmed.split('\n').map((line) => {
        const isChecked = line.startsWith('- [x]');
        const itemText = line.replace(/^- \[[ x]\]\s*/, '').trim();
        return { checked: isChecked, text: itemText };
      });
      blocks.push({ type: 'checklist', items: checkItems });
      continue;
    }

    // 12. Списки: маркований чи нумерований
    const lines = trimmed.split('\n');
    const isBulletList = lines.every((l) => /^[-*]\s+/.test(l.trim()));
    const isNumberedList = lines.every((l) => /^\d+\.\s+/.test(l.trim()));

    if (isBulletList && lines.length > 0) {
      blocks.push({
        type: 'list',
        ordered: false,
        items: lines.map((l) => l.replace(/^[-*]\s+/, '').trim()),
      });
      continue;
    }

    if (isNumberedList && lines.length > 0) {
      blocks.push({
        type: 'list',
        ordered: true,
        items: lines.map((l) => l.replace(/^\d+\.\s+/, '').trim()),
      });
      continue;
    }

    // 13. Вирівнювання тексту: [align:center]...[/align]
    const alignMatch = trimmed.match(/^\[align:(left|center|right)\]([\s\S]*?)\[\/align\]$/i);
    if (alignMatch) {
      blocks.push({
        type: 'paragraph',
        align: alignMatch[1].toLowerCase() as any,
        text: alignMatch[2].trim(),
      });
      continue;
    }

    // 14. Звичайний абзац (із підтримкою інлайн зображень / youtube всередині)
    blocks.push({ type: 'paragraph', text: trimmed });
  }

  return (
    <div className="space-y-6 text-neutral-800 leading-relaxed font-serif text-base sm:text-lg">
      {blocks.map((block, idx) => {
        // Заголовок
        if (block.type === 'heading') {
          if (block.level === 1) {
            return (
              <h2
                key={idx}
                className="text-2xl sm:text-3xl font-serif font-bold text-neutral-950 mt-10 mb-4 pt-4 border-t border-neutral-100 first:mt-0 first:pt-0 first:border-0"
              >
                {renderInlineFormatting(block.text)}
              </h2>
            );
          }
          if (block.level === 2) {
            return (
              <h3
                key={idx}
                className="text-xl sm:text-2xl font-serif font-semibold text-neutral-900 mt-8 mb-3"
              >
                {renderInlineFormatting(block.text)}
              </h3>
            );
          }
          return (
            <h4
              key={idx}
              className="text-lg sm:text-xl font-serif font-medium text-neutral-800 mt-6 mb-2 text-neutral-700"
            >
              {renderInlineFormatting(block.text)}
            </h4>
          );
        }

        // Розділювач
        if (block.type === 'divider') {
          return (
            <div key={idx} className="my-8 flex items-center justify-center gap-2">
              <span className="h-px w-16 bg-neutral-300"></span>
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-400"></span>
              <span className="h-px w-16 bg-neutral-300"></span>
            </div>
          );
        }

        // YouTube
        if (block.type === 'youtube') {
          return (
            <figure key={idx} className="my-8 sm:my-10 not-italic">
              <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black shadow-md border border-neutral-200">
                <iframe
                  src={`https://www.youtube.com/embed/${block.videoId}?rel=0&modestbranding=1`}
                  title="Відео YouTube"
                  className="w-full h-full border-0 absolute top-0 left-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  loading="lazy"
                />
              </div>
            </figure>
          );
        }

        // Фото / Зображення
        if (block.type === 'image') {
          return (
            <figure key={idx} className="my-8 sm:my-10 not-italic">
              <div
                onClick={() => setLightboxImg({ src: block.src, caption: block.caption })}
                className="group relative overflow-hidden rounded-lg bg-neutral-100 border border-neutral-200/80 shadow-xs cursor-zoom-in"
              >
                <img
                  src={block.src}
                  alt={block.caption || 'Ілюстрація до статті'}
                  loading="lazy"
                  className="w-full h-auto max-h-[720px] object-cover mx-auto transition-transform duration-300 group-hover:scale-[1.01]"
                  onError={(e) => {
                    (e.target as HTMLImageElement).alt =
                      'Не вдалося завантажити зображення';
                  }}
                />
                <div className="absolute top-3 right-3 p-1.5 bg-black/60 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                  <ZoomIn className="w-4 h-4" />
                </div>
              </div>
              {block.caption && (
                <figcaption className="text-center text-xs text-neutral-500 mt-2.5 font-sans italic">
                  {renderInlineFormatting(block.caption)}
                </figcaption>
              )}
            </figure>
          );
        }

        // Таблиця
        if (block.type === 'table') {
          return (
            <div key={idx} className="my-8 overflow-x-auto not-italic">
              <div className="inline-block min-w-full align-middle border border-neutral-200 rounded-lg overflow-hidden shadow-xs">
                <table className="min-w-full divide-y divide-neutral-200 font-sans text-sm">
                  <thead className="bg-neutral-50">
                    <tr>
                      {block.headers.map((h, hIdx) => (
                        <th
                          key={hIdx}
                          scope="col"
                          className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-800"
                        >
                          {renderInlineFormatting(h)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 bg-white">
                    {block.rows.map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        className={rIdx % 2 === 0 ? 'bg-white hover:bg-neutral-50/70' : 'bg-neutral-50/40 hover:bg-neutral-50/70'}
                      >
                        {row.map((cell, cIdx) => (
                          <td
                            key={cIdx}
                            className="px-4 py-3 text-neutral-700 leading-normal"
                          >
                            {renderInlineFormatting(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        }

        // Кольоровий Callout блок
        if (block.type === 'callout') {
          const styles: Record<
            typeof block.variant,
            { bg: string; border: string; text: string; icon: React.ReactNode; defaultTitle: string }
          > = {
            info: {
              bg: 'bg-sky-50/80',
              border: 'border-sky-300',
              text: 'text-sky-950',
              icon: <Info className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />,
              defaultTitle: 'До відома',
            },
            warning: {
              bg: 'bg-amber-50/80',
              border: 'border-amber-300',
              text: 'text-amber-950',
              icon: <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />,
              defaultTitle: 'Зверніть увагу',
            },
            success: {
              bg: 'bg-emerald-50/80',
              border: 'border-emerald-300',
              text: 'text-emerald-950',
              icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />,
              defaultTitle: 'Висновок',
            },
            danger: {
              bg: 'bg-red-50/80',
              border: 'border-red-300',
              text: 'text-red-950',
              icon: <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />,
              defaultTitle: 'Важливо',
            },
            quote: {
              bg: 'bg-neutral-50',
              border: 'border-neutral-300',
              text: 'text-neutral-900',
              icon: <QuoteIcon className="w-5 h-5 text-neutral-500 shrink-0 mt-0.5" />,
              defaultTitle: 'Цитата',
            },
            dark: {
              bg: 'bg-neutral-900',
              border: 'border-neutral-950',
              text: 'text-neutral-100',
              icon: <Info className="w-5 h-5 text-neutral-300 shrink-0 mt-0.5" />,
              defaultTitle: 'Коментар',
            },
          };

          const cur = styles[block.variant] || styles.info;

          return (
            <div
              key={idx}
              className={`my-7 p-5 rounded-lg border-l-4 ${cur.border} ${cur.bg} ${cur.text} shadow-xs`}
            >
              <div className="flex items-start gap-3">
                {cur.icon}
                <div className="flex-1 font-sans text-sm sm:text-base">
                  {block.title && (
                    <div className="font-semibold text-xs uppercase tracking-wider mb-1.5 opacity-90">
                      {block.title}
                    </div>
                  )}
                  <div className="leading-relaxed">{renderInlineFormatting(block.content)}</div>
                </div>
              </div>
            </div>
          );
        }

        // Цитата
        if (block.type === 'quote') {
          return (
            <blockquote
              key={idx}
              className="my-8 pl-5 sm:pl-7 border-l-2 border-black italic text-neutral-900 font-serif text-lg sm:text-xl leading-relaxed"
            >
              <p>«{renderInlineFormatting(block.text)}»</p>
              {block.author && (
                <footer className="not-italic text-xs font-sans text-neutral-500 mt-2 font-medium">
                  — {block.author}
                </footer>
              )}
            </blockquote>
          );
        }

        // Списки
        if (block.type === 'list') {
          if (block.ordered) {
            return (
              <ol key={idx} className="my-5 pl-6 list-decimal space-y-2 font-serif">
                {block.items.map((it, iIdx) => (
                  <li key={iIdx} className="leading-relaxed">
                    {renderInlineFormatting(it)}
                  </li>
                ))}
              </ol>
            );
          }
          return (
            <ul key={idx} className="my-5 pl-6 list-disc space-y-2 font-serif">
              {block.items.map((it, iIdx) => (
                <li key={iIdx} className="leading-relaxed">
                  {renderInlineFormatting(it)}
                </li>
              ))}
            </ul>
          );
        }

        // Чек-лист (завдання)
        if (block.type === 'checklist') {
          return (
            <div key={idx} className="my-5 space-y-2 font-sans text-sm sm:text-base">
              {block.items.map((item, cIdx) => (
                <div key={cIdx} className="flex items-start gap-2.5">
                  {item.checked ? (
                    <CheckSquare className="w-4 h-4 text-emerald-600 mt-1 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-neutral-400 mt-1 shrink-0" />
                  )}
                  <span
                    className={
                      item.checked
                        ? 'line-through text-neutral-500'
                        : 'text-neutral-800'
                    }
                  >
                    {renderInlineFormatting(item.text)}
                  </span>
                </div>
              ))}
            </div>
          );
        }

        // Звичайний абзац
        const alignClass =
          block.align === 'center'
            ? 'text-center'
            : block.align === 'right'
            ? 'text-right'
            : 'text-left';

        return (
          <p key={idx} className={`whitespace-pre-line leading-relaxed ${alignClass}`}>
            {renderInlineFormatting(block.text)}
          </p>
        );
      })}

      {/* Lightbox модальне вікно для фотографій */}
      {lightboxImg && (
        <div
          onClick={() => setLightboxImg(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8 animate-fade-in"
        >
          <button
            onClick={() => setLightboxImg(null)}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors cursor-pointer"
            title="Закрити (Esc)"
          >
            <X className="w-6 h-6" />
          </button>
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-5xl max-h-[90vh] flex flex-col items-center"
          >
            <img
              src={lightboxImg.src}
              alt={lightboxImg.caption || 'Зображення'}
              className="max-h-[82vh] w-auto max-w-full rounded-md object-contain shadow-2xl"
            />
            {lightboxImg.caption && (
              <p className="text-white/80 text-xs sm:text-sm mt-3 text-center font-sans max-w-xl">
                {lightboxImg.caption}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
