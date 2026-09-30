/**
 * Форматує час публікації матеріалу відповідно до правила:
 * - Якщо минуло менше 7 днів: показує скільки часу минуло ("щойно", "5 хв тому", "2 год тому", "вчора", "3 дні тому").
 * - Якщо минуло 7 днів або більше: показує дату (наприклад: "22 вересня 2026").
 */
export function formatTimeAgoOrDate(
  createdAt?: string,
  dateStr?: string,
  id?: string
): string {
  let targetDate: Date | null = null;

  // 1. Спроба взяти точний timestamp з createdAt (з бази даних)
  if (createdAt) {
    const parsed = new Date(createdAt);
    if (!isNaN(parsed.getTime())) {
      targetDate = parsed;
    }
  }

  // 2. Спроба взяти timestamp з id (якщо id згенеровано через Date.now())
  if (!targetDate && id && /^\d{12,14}$/.test(id)) {
    const timestamp = parseInt(id, 10);
    const parsed = new Date(timestamp);
    if (!isNaN(parsed.getTime())) {
      targetDate = parsed;
    }
  }

  // 3. Спроба розпарсити dateStr
  if (!targetDate && dateStr) {
    // Якщо дата має українські місяці або стандартний ISO
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      targetDate = parsed;
    }
  }

  // Якщо не вдалося визначити дату, повертаємо початковий рядок
  if (!targetDate) {
    return dateStr || '';
  }

  const now = new Date();
  const diffMs = now.getTime() - targetDate.getTime();

  // Якщо створено щойно (до 1 хвилини) або дата дещо в майбутньому через різницю годинників
  if (diffMs <= 60 * 1000) {
    return 'щойно';
  }

  const diffMinutes = Math.floor(diffMs / (60 * 1000));
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  // Менше 60 хвилин
  if (diffMinutes < 60) {
    return `${diffMinutes} ${getPluralUkrainian(diffMinutes, 'хвилину', 'хвилини', 'хвилин')} тому`;
  }

  // Менше 24 годин
  if (diffHours < 24) {
    return `${diffHours} ${getPluralUkrainian(diffHours, 'годину', 'години', 'годин')} тому`;
  }

  // Менше 7 днів (до тижня)
  if (diffDays < 7) {
    if (diffDays === 1) return 'вчора';
    return `${diffDays} ${getPluralUkrainian(diffDays, 'день', 'дні', 'днів')} тому`;
  }

  // Більше або дорівнює тижню: показуємо календарну дату
  return targetDate.toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getPluralUkrainian(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 19) {
    return many;
  }
  if (mod10 === 1) {
    return one;
  }
  if (mod10 >= 2 && mod10 <= 4) {
    return few;
  }
  return many;
}
