import type { Category } from '../db/types';

/**
 * Цвет статьи закреплён за её местом в общем списке (включая архивные):
 * один и тот же цвет в аналитике, в списке статей и на быстрых кнопках.
 * Возвращает номер цвета 1–8 или 0 («прочие», если статей больше восьми).
 */
export function categoryColorIndex(catId: string, all: Category[]): number {
  const i = all.findIndex((c) => c.id === catId);
  return i >= 0 && i < 8 ? i + 1 : 0;
}

/** CSS-цвет статьи (переменная темы — сам подстраивается под светлую/тёмную). */
export function categoryColor(catId: string, all: Category[]): string {
  const n = categoryColorIndex(catId, all);
  return n ? `var(--series-${n})` : 'var(--series-other)';
}

/** Мягкая подложка цвета статьи поверх карточки. */
export function categoryTint(catId: string, all: Category[], percent = 18): string {
  return `color-mix(in srgb, ${categoryColor(catId, all)} ${percent}%, var(--card))`;
}
