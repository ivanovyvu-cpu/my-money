const fmt = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2, minimumFractionDigits: 0 });

/** 12345.5 → «12 345,5 ₽» */
export function money(n: number): string {
  return `${fmt.format(round2(n)).replace(/ | /g, ' ')} ₽`;
}

/** Со знаком: «+1 200 ₽» / «−300 ₽» */
export function moneySigned(n: number): string {
  if (n > 0) return `+${money(n)}`;
  if (n < 0) return `−${money(-n)}`;
  return money(0);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Разбирает ввод суммы: «1 234,50» → 1234.5. Неверный ввод → NaN. */
export function parseAmount(s: string): number {
  const clean = s.replace(/[\s  ₽]/g, '').replace(',', '.');
  if (!/^\d*\.?\d{0,2}$/.test(clean) || clean === '' || clean === '.') return NaN;
  return round2(Number(clean));
}

/** Число → строка для поля ввода: 1234.5 → «1234,5» */
export function amountToInput(n: number): string {
  return n ? String(round2(n)).replace('.', ',') : '';
}

export function sum<T>(items: T[], pick: (x: T) => number): number {
  return round2(items.reduce((acc, x) => acc + pick(x), 0));
}

/** Склонение: plural(3, ['день','дня','дней']) */
export function plural(n: number, forms: [string, string, string]): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}
