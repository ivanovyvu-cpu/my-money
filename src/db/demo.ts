import { db, uid } from './db';
import type { Category, ClosedPeriod, Deviation, Expense, Income, Jar, JarOperation } from './types';
import { getSettings } from './actions';
import { addDays, daysBetweenInclusive, fromISO, periodRange, today } from '../lib/dates';
import { round2 } from '../lib/format';

// Демонстрационные данные за последние 6 месяцев. Заменяют все текущие данные.

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

interface DemoCat {
  name: string;
  icon: string;
  limit: number;
  titles: string[];
  /** Средняя доля лимита, которую тратим за месяц. */
  usage: number;
  /** Доля лимита в текущем (незавершённом) месяце. */
  current: number;
  count: number;
}

const CATS: DemoCat[] = [
  { name: 'Продукты', icon: '🛒', limit: 30000, titles: ['Пятёрочка', 'Рынок', 'ВкусВилл', 'Перекрёсток', 'Хлеб и молоко'], usage: 0.93, current: 0.62, count: 14 },
  { name: 'Коммунальные услуги', icon: '💡', limit: 8000, titles: ['Квартплата', 'Электричество', 'Интернет', 'Мобильная связь'], usage: 0.97, current: 0.85, count: 3 },
  { name: 'Дети', icon: '🧸', limit: 15000, titles: ['Кружок рисования', 'Одежда', 'Игрушки', 'Школа', 'Бассейн'], usage: 0.9, current: 0.45, count: 5 },
  { name: 'Машина', icon: '🚗', limit: 10000, titles: ['Бензин', 'Мойка', 'Парковка', 'Шиномонтаж'], usage: 1.05, current: 0.88, count: 5 },
  { name: 'Траты на себя', icon: '💅', limit: 7000, titles: ['Кофе', 'Книга', 'Кино', 'Косметика', 'Обед в кафе'], usage: 1.0, current: 1.12, count: 6 },
];

export async function fillDemoData() {
  const prev = await getSettings();
  const { monthStartDay } = prev;
  const rand = rng(42);
  const t = today();
  const cur = periodRange(t, 'month', monthStartDay);

  // 6 месяцев: 5 прошедших + текущий.
  const months = [cur];
  for (let i = 0; i < 5; i++) months.unshift(periodRange(addDays(months[0].start, -1), 'month', monthStartDay));

  const categories: Category[] = [];
  const expenses: Expense[] = [];
  const closed: ClosedPeriod[] = [];
  const deviations: Deviation[] = [];
  const jars: Jar[] = [];
  const jarOps: JarOperation[] = [];
  const incomes: Income[] = [];

  const jarDefs: Array<[string, string, number, string | undefined]> = [
    ['На мечту', '✨', 300000, addDays(t, 365)],
    ['Подарок себе', '🎁', 20000, addDays(t, 60)],
    ['Новая машина', '🚙', 1500000, undefined],
    ['Излишки', '🫙', 0, undefined],
  ];
  jarDefs.forEach(([name, icon, goalAmount, targetDate], i) =>
    jars.push({ id: uid(), name, icon, goalAmount, targetDate, order: i, archived: false }),
  );
  const surplusJar = jars[3];

  CATS.forEach((c, ci) => {
    const cat: Category = {
      id: uid(),
      name: c.name,
      icon: c.icon,
      limit: c.limit,
      period: 'month',
      currentPeriodStart: cur.start,
      carryOver: 0,
      order: ci,
      archived: false,
    };
    categories.push(cat);

    months.forEach((m, mi) => {
      const isCurrent = mi === months.length - 1;
      const lastDay = isCurrent ? t : m.end;
      const days = daysBetweenInclusive(m.start, lastDay);
      const share = isCurrent ? c.current : c.usage * (0.85 + rand() * 0.3);
      const total = Math.round(c.limit * share);
      const n = Math.max(1, Math.round(c.count * (isCurrent ? days / 30 : 1)));
      let spent = 0;
      for (let k = 0; k < n; k++) {
        const amount = k === n - 1 ? round2(total - spent) : round2(Math.round((total / n) * (0.6 + rand() * 0.8)));
        if (amount <= 0) continue;
        spent = round2(spent + amount);
        const date = addDays(m.start, Math.floor(rand() * days));
        expenses.push({
          id: uid(),
          categoryId: cat.id,
          title: c.titles[Math.floor(rand() * c.titles.length)],
          amount,
          date,
          createdAt: Date.now() - (months.length - mi) * 1e9 + k,
        });
      }
      if (isCurrent) return;
      const difference = round2(c.limit - spent);
      const rec: ClosedPeriod = {
        id: uid(),
        categoryId: cat.id,
        start: m.start,
        end: m.end,
        limit: c.limit,
        spent,
        difference,
        resolution: 'none',
        // Период закрыт на следующий день после окончания.
        createdAt: Math.min(Date.now(), fromISO(addDays(m.end, 1)).getTime() + 10 * 3600_000),
      };
      if (difference > 0) {
        rec.resolution = 'to_jar';
        rec.jarId = surplusJar.id;
        jarOps.push({
          id: uid(),
          jarId: surplusJar.id,
          type: 'deposit',
          amount: difference,
          date: m.end,
          note: '',
          source: `Излишки по статье «${c.name}»`,
          createdAt: Date.now(),
        });
      } else if (difference < 0) {
        rec.resolution = 'deviation';
        deviations.push({
          id: uid(),
          categoryId: cat.id,
          periodStart: m.start,
          periodEnd: m.end,
          amount: -difference,
          createdAt: Date.now(),
        });
      }
      closed.push(rec);
    });
  });

  // Оставляем пару отклонений, чтобы было видно плашку, но не перегружать.
  deviations.splice(0, Math.max(0, deviations.length - 2));
  const keptDev = new Set(deviations.map((d) => `${d.categoryId}|${d.periodStart}`));
  for (const r of closed) {
    if (r.resolution === 'deviation' && !keptDev.has(`${r.categoryId}|${r.start}`)) r.resolution = 'carried_over';
  }

  // Доходы и регулярные взносы в копилки.
  months.forEach((m, mi) => {
    const isCurrent = mi === months.length - 1;
    incomes.push({ id: uid(), title: 'Зарплата', amount: 95000, date: addDays(m.start, 4), createdAt: Date.now() });
    if (!isCurrent || daysBetweenInclusive(m.start, t) > 19)
      incomes.push({ id: uid(), title: 'Аванс', amount: 45000, date: addDays(m.start, 19), createdAt: Date.now() });
    if (mi % 2 === 0)
      incomes.push({ id: uid(), title: 'Подработка', amount: 12000, date: addDays(m.start, 12), createdAt: Date.now() });
    const depDate = addDays(m.start, 5) > t ? t : addDays(m.start, 5);
    jarOps.push(
      { id: uid(), jarId: jars[0].id, type: 'deposit', amount: 15000, date: depDate, note: 'Ежемесячный взнос', createdAt: Date.now() },
      { id: uid(), jarId: jars[2].id, type: 'deposit', amount: 25000, date: depDate, note: 'Ежемесячный взнос', createdAt: Date.now() },
    );
    if (mi >= 3)
      jarOps.push({ id: uid(), jarId: jars[1].id, type: 'deposit', amount: 5000, date: depDate, note: '', createdAt: Date.now() });
  });
  jarOps.push({
    id: uid(),
    jarId: jars[0].id,
    type: 'withdraw',
    amount: 8000,
    date: addDays(months[2].start, 15),
    note: 'Билеты на концерт',
    createdAt: Date.now(),
  });

  await db.transaction('rw', [db.categories, db.expenses, db.jars, db.jarOperations, db.incomes, db.closedPeriods, db.deviations, db.settings], async () => {
    // Всё в одной транзакции: при ошибке старые данные останутся нетронутыми.
    for (const tb of [db.categories, db.expenses, db.jars, db.jarOperations, db.incomes, db.closedPeriods, db.deviations]) await tb.clear();
    await db.settings.put({ ...prev, key: 'app', seeded: true });
    await db.categories.bulkAdd(categories);
    await db.expenses.bulkAdd(expenses);
    await db.jars.bulkAdd(jars);
    await db.jarOperations.bulkAdd(jarOps);
    await db.incomes.bulkAdd(incomes);
    await db.closedPeriods.bulkAdd(closed);
    await db.deviations.bulkAdd(deviations);
  });
}
