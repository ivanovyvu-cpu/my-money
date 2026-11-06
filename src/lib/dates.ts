import type { Period } from '../db/types';

// Все даты — строки 'YYYY-MM-DD' в локальном часовом поясе.

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function today(): string {
  return toISO(new Date());
}

export function addDays(s: string, n: number): string {
  const d = fromISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/** Количество дней между датами включительно. */
export function daysBetweenInclusive(a: string, b: string): number {
  const ms = fromISO(b).getTime() - fromISO(a).getTime();
  return Math.round(ms / 86_400_000) + 1;
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate();
}

/** Дата в месяце (y, m) с днём anchor (если месяц короче — последний день). */
function anchoredDate(y: number, m: number, anchor: number): Date {
  const yy = y + Math.floor(m / 12);
  const mm = ((m % 12) + 12) % 12;
  return new Date(yy, mm, Math.min(anchor, daysInMonth(yy, mm)));
}

export interface DateRange {
  start: string;
  end: string;
}

/**
 * «Естественный» период, в который попадает дата:
 * неделя — с понедельника; месяц — с дня monthStartDay;
 * квартал — январь/апрель/июль/октябрь; год — с января (тоже с monthStartDay).
 */
export function periodRange(date: string, period: Period, monthStartDay = 1): DateRange {
  const d = fromISO(date);
  if (period === 'week') {
    const dow = (d.getDay() + 6) % 7; // 0 = понедельник
    const start = addDays(date, -dow);
    return { start, end: addDays(start, 6) };
  }
  const step = period === 'month' ? 1 : period === 'quarter' ? 3 : 12;
  // Месяц, с которого начинается период, содержащий дату.
  let m = d.getMonth();
  let y = d.getFullYear();
  if (d < anchoredDate(y, m, monthStartDay)) m -= 1;
  // Выравниваем по кварталу / году.
  const abs = y * 12 + m;
  const aligned = abs - (((abs % step) + step) % step);
  y = Math.floor(aligned / 12);
  m = aligned % 12;
  const start = anchoredDate(y, m, monthStartDay);
  const next = anchoredDate(y, m + step, monthStartDay);
  next.setDate(next.getDate() - 1);
  return { start: toISO(start), end: toISO(next) };
}

export function monthRange(date: string, monthStartDay: number): DateRange {
  return periodRange(date, 'month', monthStartDay);
}

const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const MONTHS_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const MONTHS_NOM_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

/** «5 мар» или «5 мар 2025», если год не текущий. */
export function formatDate(s: string): string {
  const d = fromISO(s);
  const base = `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
  return d.getFullYear() === new Date().getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

export function formatRange(r: DateRange): string {
  return `${formatDate(r.start)} — ${formatDate(r.end)}`;
}

export function monthName(s: string): string {
  const d = fromISO(s);
  return `${MONTHS_NOM[d.getMonth()]} ${d.getFullYear()}`;
}

export function monthShort(s: string): string {
  return MONTHS_NOM_SHORT[fromISO(s).getMonth()];
}

/** Полных и неполных месяцев от сегодня до даты (минимум 1). */
export function monthsUntil(target: string): number {
  const days = daysBetweenInclusive(today(), target);
  return Math.max(1, Math.ceil(days / 30.44));
}
