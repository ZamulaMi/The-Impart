import React from 'react';

interface ContentRendererProps {
  content: string;
}

// Функція видобування YouTube Video ID
export function getYouTubeId(url: string): string | null {
  const clean = url.trim();
  const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
  const match = clean.match(regExp);
  return match ? match[1] : null;
}

// Функція перевірки, чи є рядок посиланням на зображення
export function isImageUrl(url: string): boolean {
  const clean = url.trim();
  if (/^https?:\/\/.*\.(?:jpg|jpeg|png|webp|gif|svg|avif)(?:[?#].*)?$/i.test(clean)) {
    return true;
  }
  if (/^https?:\/\/images\.unsplash\.com\/.+/i.test(clean)) {
    return true;
  }
  return false;
}

type Block =
  | { type: 'youtube'; videoId: string; url: string }
  | { type: 'image'; src: string; caption?: string }
  | { type: 'paragraph'; text: string };

export const ContentRenderer: React.FC<ContentRendererProps> = ({ content }) => {
  if (!content) return null;

  // Розбиваємо текст на рядки/абзаци
  const rawParagraphs = content.split(/\n\s*\n/);
  const blocks: Block[] = [];

  for (const rawPara of rawParagraphs) {
    const trimmed = rawPara.trim();
    if (!trimmed) continue;

    // Перевірка на Markdown зображення: ![alt](url)
    const mdImageMatch = trimmed.match(/^!\[(.*?)\]\((https?:\/\/[^\s)]+)\)$/);
    if (mdImageMatch) {
      blocks.push({
        type: 'image',
        src: mdImageMatch[2],
        caption: mdImageMatch[1] || undefined,
      });
      continue;
    }

    // Перевірка на тег [video: URL] або [youtube: URL]
    const videoTagMatch = trimmed.match(/^\[(?:video|youtube):\s*(https?:\/\/[^\s\]]+)\]$/i);
    if (videoTagMatch) {
      const vid = getYouTubeId(videoTagMatch[1]);
      if (vid) {
        blocks.push({ type: 'youtube', videoId: vid, url: videoTagMatch[1] });
        continue;
      }
    }

    // Перевірка на тег [photo: URL] або [image: URL]
    const photoTagMatch = trimmed.match(/^\[(?:photo|image|img):\s*(https?:\/\/[^\s\]]+)(?:\s+"(.*?)")?\]$/i);
    if (photoTagMatch) {
      blocks.push({
        type: 'image',
        src: photoTagMatch[1],
        caption: photoTagMatch[2] || undefined,
      });
      continue;
    }

    // Перевірка, чи весь абзац є окремим посиланням на YouTube
    const ytId = getYouTubeId(trimmed);
    if (ytId && (trimmed.startsWith('http://') || trimmed.startsWith('https://')) && !trimmed.includes(' ')) {
      blocks.push({ type: 'youtube', videoId: ytId, url: trimmed });
      continue;
    }

    // Перевірка, чи весь абзац є окремим посиланням на зображення
    if (isImageUrl(trimmed) && !trimmed.includes(' ')) {
      blocks.push({ type: 'image', src: trimmed });
      continue;
    }

    // Якщо всередині абзацу є окремі рядки з медіа
    const lines = trimmed.split('\n');
    let currentTextLines: string[] = [];

    for (const line of lines) {
      const lineTrim = line.trim();

      // Окремий рядок YouTube
      const lineYt = getYouTubeId(lineTrim);
      if (lineYt && (lineTrim.startsWith('http://') || lineTrim.startsWith('https://')) && !lineTrim.includes(' ')) {
        if (currentTextLines.length > 0) {
          blocks.push({ type: 'paragraph', text: currentTextLines.join('\n') });
          currentTextLines = [];
        }
        blocks.push({ type: 'youtube', videoId: lineYt, url: lineTrim });
        continue;
      }

      // Окремий рядок зображення
      if (isImageUrl(lineTrim) && !lineTrim.includes(' ')) {
        if (currentTextLines.length > 0) {
          blocks.push({ type: 'paragraph', text: currentTextLines.join('\n') });
          currentTextLines = [];
        }
        blocks.push({ type: 'image', src: lineTrim });
        continue;
      }

      // Окремий рядок markdown image
      const lineMdImage = lineTrim.match(/^!\[(.*?)\]\((https?:\/\/[^\s)]+)\)$/);
      if (lineMdImage) {
        if (currentTextLines.length > 0) {
          blocks.push({ type: 'paragraph', text: currentTextLines.join('\n') });
          currentTextLines = [];
        }
        blocks.push({
          type: 'image',
          src: lineMdImage[2],
          caption: lineMdImage[1] || undefined,
        });
        continue;
      }

      currentTextLines.push(line);
    }

    if (currentTextLines.length > 0) {
      blocks.push({ type: 'paragraph', text: currentTextLines.join('\n') });
    }
  }

  return (
    <div className="space-y-7">
      {blocks.map((block, index) => {
        if (block.type === 'youtube') {
          return (
            <figure key={index} className="my-8 sm:my-10">
              <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black shadow-md border border-neutral-200">
                <iframe
                  src={`https://www.youtube.com/embed/${block.videoId}?rel=0&modestbranding=1`}
                  title="Відео YouTube"
                  className="w-full h-full border-0 absolute top-0 left-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            </figure>
          );
        }

        if (block.type === 'image') {
          return (
            <figure key={index} className="my-8 sm:my-10">
              <div className="overflow-hidden rounded-lg bg-neutral-100 border border-neutral-100 shadow-xs">
                <img
                  src={block.src}
                  alt={block.caption || 'Ілюстрація до статті'}
                  loading="lazy"
                  className="w-full h-auto max-h-[680px] object-cover mx-auto"
                  onError={(e) => {
                    // Якщо фото не завантажилось
                    (e.target as HTMLImageElement).alt = 'Не вдалося завантажити зображення за посиланням';
                  }}
                />
              </div>
              {block.caption && (
                <figcaption className="text-center text-xs text-neutral-500 mt-2.5 font-sans italic">
                  {block.caption}
                </figcaption>
              )}
            </figure>
          );
        }

        return (
          <p key={index} className="whitespace-pre-line text-neutral-800 leading-relaxed font-serif">
            {block.text}
          </p>
        );
      })}
    </div>
  );
};
