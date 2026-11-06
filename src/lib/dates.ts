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

export type HomeRangeKind = 'month' | '3m' | '6m' | 'year';

export const HOME_RANGE_OPTIONS: Array<{ value: HomeRangeKind; label: string; hint: string }> = [
  { value: 'month', label: 'Текущий месяц', hint: 'с начала месяца' },
  { value: '3m', label: '3 месяца', hint: 'текущий и 2 предыдущих' },
  { value: '6m', label: '6 месяцев', hint: 'текущий и 5 предыдущих' },
  { value: 'year', label: 'Этот год', hint: 'с начала календарного года' },
];

export interface HomeView {
  range: DateRange;
  /** Сколько месяцев входит (для пересчёта месячных лимитов). */
  months: number;
  /** Подпись периода над заголовком: «Ноябрь 2026», «Сен — Ноя 2026». */
  title: string;
  /** Для фраз: «за месяц», «за 3 месяца», «за год». */
  short: string;
}

/** Диапазон для сводки на главном экране: всегда заканчивается концом текущего месяца. */
export function homeView(kind: HomeRangeKind, monthStartDay: number, date = today()): HomeView {
  const cur = monthRange(date, monthStartDay);
  let start = cur.start;
  let months = 1;
  if (kind === '3m' || kind === '6m') {
    const back = kind === '3m' ? 2 : 5;
    for (let i = 0; i < back; i++) start = monthRange(addDays(start, -1), monthStartDay).start;
    months = back + 1;
  } else if (kind === 'year') {
    start = periodRange(date, 'year', monthStartDay).start;
    months = 1;
    for (let s = cur.start; s > start; s = monthRange(addDays(s, -1), monthStartDay).start) months++;
  }
  const range = { start, end: cur.end };
  const title =
    kind === 'month'
      ? monthName(cur.start)
      : kind === 'year'
        ? `${fromISO(cur.start).getFullYear()} год · ${months} ${months === 1 ? 'месяц' : months < 5 ? 'месяца' : 'месяцев'}`
        : `${MONTHS_NOM_SHORT[fromISO(start).getMonth()]} — ${MONTHS_NOM_SHORT[fromISO(cur.start).getMonth()]} ${fromISO(cur.start).getFullYear()}`;
  const short = kind === 'month' ? 'за месяц' : kind === 'year' ? 'за год' : `за ${months} месяц${months < 5 ? 'а' : 'ев'}`;
  return { range, months, title: title.charAt(0).toUpperCase() + title.slice(1), short };
}
