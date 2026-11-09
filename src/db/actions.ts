import { db, uid } from './db';
import type {
  AppSettings,
  Category,
  ClosedPeriod,
  Deviation,
  Repayment,
  Expense,
  Income,
  Jar,
  JarOperation,
  Period,
  Resolution,
} from './types';
import { addDays, periodRange, today } from '../lib/dates';
import { categoryStats } from '../lib/calc';
import { round2 } from '../lib/format';

// Все изменения данных проходят через эти функции — экраны не пишут в базу напрямую.

export const DEFAULT_SETTINGS: AppSettings = {
  key: 'app',
  theme: 'system',
  monthStartDay: 1,
  seeded: false,
};

export async function getSettings(): Promise<AppSettings> {
  return (await db.settings.get('app')) ?? DEFAULT_SETTINGS;
}

export async function updateSettings(patch: Partial<Omit<AppSettings, 'key'>>) {
  const cur = await getSettings();
  await db.settings.put({ ...cur, ...patch, key: 'app' });
}

export const STARTER_CATEGORIES: Array<[string, string]> = [
  ['Продукты', '🛒'],
  ['Коммунальные услуги', '💡'],
  ['Дети', '🧸'],
  ['Машина', '🚗'],
  ['Траты на себя', '💅'],
];

export const STARTER_JARS: Array<[string, string]> = [
  ['На мечту', '✨'],
  ['Подарок себе', '🎁'],
  ['Новая машина', '🚙'],
  ['Излишки', '🫙'],
];

export const SURPLUS_JAR_NAME = 'Излишки';

/** При первом запуске создаёт стартовые статьи и копилки. */
export async function ensureSeeded() {
  await db.transaction('rw', db.settings, db.categories, db.jars, async () => {
    const s = await getSettings();
    if (s.seeded) return;
    await createStarterData(s.monthStartDay);
    await db.settings.put({ ...s, seeded: true });
  });
}

export async function createStarterData(monthStartDay: number) {
  const start = periodRange(today(), 'month', monthStartDay).start;
  await db.categories.bulkAdd(
    STARTER_CATEGORIES.map(([name, icon], i) => ({
      id: uid(),
      name,
      icon,
      limit: 0,
      period: 'month' as Period,
      currentPeriodStart: start,
      carryOver: 0,
      order: i,
      archived: false,
    })),
  );
  await db.jars.bulkAdd(
    STARTER_JARS.map(([name, icon], i) => ({
      id: uid(),
      name,
      icon,
      goalAmount: 0,
      order: i,
      archived: false,
    })),
  );
}

// ---------- Статьи расходов ----------

export async function addCategory(data: { name: string; icon: string; limit: number; period: Period }) {
  const { monthStartDay } = await getSettings();
  const last = await db.categories.orderBy('order').last();
  const cat: Category = {
    id: uid(),
    ...data,
    currentPeriodStart: periodRange(today(), data.period, monthStartDay).start,
    carryOver: 0,
    order: (last?.order ?? -1) + 1,
    archived: false,
  };
  await db.categories.add(cat);
  return cat;
}

export async function updateCategory(id: string, patch: Partial<Category>) {
  const cur = await db.categories.get(id);
  if (!cur) return;
  // При смене периодичности начинаем новый период с начала текущего.
  if (patch.period && patch.period !== cur.period) {
    const { monthStartDay } = await getSettings();
    patch.currentPeriodStart = periodRange(today(), patch.period, monthStartDay).start;
  }
  await db.categories.update(id, patch);
}

export async function archiveCategory(id: string) {
  await db.categories.update(id, { archived: true });
}

export async function restoreCategory(id: string) {
  await db.categories.update(id, { archived: false });
}

/** Полное удаление статьи вместе с её операциями и историей. */
export async function deleteCategory(id: string) {
  await db.transaction('rw', [db.categories, db.expenses, db.closedPeriods, db.deviations], async () => {
    await db.expenses.where('categoryId').equals(id).delete();
    await db.closedPeriods.where('categoryId').equals(id).delete();
    await db.deviations.where('categoryId').equals(id).delete();
    await db.categories.delete(id);
  });
}

// ---------- Траты ----------

export async function addExpense(data: Omit<Expense, 'id' | 'createdAt'>): Promise<string> {
  const id = uid();
  await db.expenses.add({ ...data, id, createdAt: Date.now() });
  return id;
}

export async function updateExpense(id: string, patch: Partial<Expense>) {
  await db.expenses.update(id, patch);
}

export async function deleteExpense(id: string) {
  await db.expenses.delete(id);
}

/** Отметить запланированную трату оплаченной (сегодняшним числом). */
export async function markPlannedPaid(id: string) {
  await db.expenses.update(id, { planned: false, date: today(), createdAt: Date.now() });
}

// ---------- Быстрые кнопки ----------

export async function addQuickTemplate(data: { title: string; categoryId: string; amount?: number }) {
  const last = await db.quickTemplates.orderBy('order').last();
  await db.quickTemplates.add({ ...data, id: uid(), order: (last?.order ?? -1) + 1, createdAt: Date.now() });
}

export async function updateQuickTemplate(id: string, patch: { title: string; categoryId: string; amount?: number }) {
  await db.quickTemplates.update(id, patch);
}

export async function deleteQuickTemplate(id: string) {
  await db.quickTemplates.delete(id);
}

// ---------- Копилки ----------

export async function addJar(data: { name: string; icon: string; goalAmount: number; targetDate?: string }) {
  const last = await db.jars.orderBy('order').last();
  const jar: Jar = { id: uid(), ...data, order: (last?.order ?? -1) + 1, archived: false };
  await db.jars.add(jar);
  return jar;
}

export async function updateJar(id: string, patch: Partial<Jar>) {
  await db.jars.update(id, patch);
}

export async function archiveJar(id: string) {
  await db.jars.update(id, { archived: true });
}

export async function deleteJar(id: string) {
  await db.transaction('rw', db.jars, db.jarOperations, async () => {
    await db.jarOperations.where('jarId').equals(id).delete();
    await db.jars.delete(id);
  });
}

export async function addJarOperation(data: Omit<JarOperation, 'id' | 'createdAt'>) {
  await db.jarOperations.add({ ...data, id: uid(), createdAt: Date.now() });
}

export async function updateJarOperation(id: string, patch: Partial<JarOperation>) {
  await db.jarOperations.update(id, patch);
}

/** Удаляет операцию копилки и откатывает то, что она сделала (пополнение статьи, погашение). */
export async function deleteJarOperation(id: string) {
  await db.transaction('rw', [db.jarOperations, db.categories, db.deviations], async () => {
    const op = await db.jarOperations.get(id);
    if (!op) return;
    if (op.link?.kind === 'topup') {
      const cat = await db.categories.get(op.link.categoryId);
      if (cat) await db.categories.update(cat.id, { carryOver: round2((cat.carryOver || 0) + op.amount) });
    } else if (op.link?.kind === 'repay') {
      await removeRepayments((r) => r.jarOpId === id);
    }
    await db.jarOperations.delete(id);
  });
}

/** Снять из копилки и добавить к лимиту статьи в текущем периоде. */
export async function topUpCategoryFromJar(data: { jarId: string; categoryId: string; amount: number; date: string; note: string }) {
  await db.transaction('rw', [db.jarOperations, db.categories], async () => {
    const cat = await db.categories.get(data.categoryId);
    if (!cat) throw new Error('Статья не найдена');
    await addJarOperation({
      jarId: data.jarId,
      type: 'withdraw',
      amount: data.amount,
      date: data.date,
      note: data.note,
      source: `На статью «${cat.name}»`,
      link: { kind: 'topup', categoryId: cat.id },
    });
    await db.categories.update(cat.id, { carryOver: round2((cat.carryOver || 0) - data.amount) });
  });
}

// ---------- Доходы ----------

export async function addIncome(data: Omit<Income, 'id' | 'createdAt'>) {
  await db.incomes.add({ ...data, id: uid(), createdAt: Date.now() });
}

export async function updateIncome(id: string, patch: Partial<Income>) {
  await db.incomes.update(id, patch);
}

/** Удаляет поступление и погашения перерасхода, сделанные из него. */
export async function deleteIncome(id: string) {
  await db.transaction('rw', [db.incomes, db.deviations], async () => {
    await removeRepayments((r) => r.incomeId === id);
    await db.incomes.delete(id);
  });
}

export async function addIncomeAndRepay(data: Omit<Income, 'id' | 'createdAt'>, repay: number) {
  await db.transaction('rw', [db.incomes, db.deviations, db.jarOperations], async () => {
    const id = uid();
    await db.incomes.add({ ...data, id, createdAt: Date.now() });
    if (repay > 0) await repayDeviations(repay, { source: 'income', incomeId: id, date: data.date });
  });
}

// ---------- Перерасход (Deviation) ----------

/** Сколько ещё не погашено. */
export function deviationLeft(d: Deviation): number {
  return round2(d.amount - (d.repayments ?? []).reduce((a, r) => a + r.amount, 0));
}

export async function deleteDeviation(id: string) {
  await db.deviations.delete(id);
}

export type RepaySource =
  | { source: 'jar'; jarId: string; date: string }
  | { source: 'income'; incomeId: string; date: string }
  | { source: 'cash'; date: string };

/**
 * Гасит перерасход на сумму amount: сначала самый старый (или только указанный в onlyId).
 * Для копилки создаёт операцию снятия. Возвращает фактически погашенную сумму.
 */
export async function repayDeviations(amount: number, src: RepaySource, onlyId?: string): Promise<number> {
  return db.transaction('rw', [db.deviations, db.jarOperations], async () => {
    const open = (await db.deviations.toArray())
      .filter((d) => deviationLeft(d) > 0 && (!onlyId || d.id === onlyId))
      .sort((a, b) => a.periodEnd.localeCompare(b.periodEnd) || a.createdAt - b.createdAt);
    const total = round2(open.reduce((a, d) => a + deviationLeft(d), 0));
    const pay = round2(Math.min(amount, total));
    if (pay <= 0) return 0;

    let jarOpId: string | undefined;
    if (src.source === 'jar') {
      jarOpId = uid();
      await db.jarOperations.add({
        id: jarOpId,
        jarId: src.jarId,
        type: 'withdraw',
        amount: pay,
        date: src.date,
        note: '',
        source: 'Погашение перерасхода',
        link: { kind: 'repay' },
        createdAt: Date.now(),
      });
    }

    let rest = pay;
    for (const d of open) {
      if (rest <= 0) break;
      const part = round2(Math.min(rest, deviationLeft(d)));
      const rep: Repayment = {
        id: uid(),
        date: src.date,
        amount: part,
        source: src.source,
        jarId: src.source === 'jar' ? src.jarId : undefined,
        jarOpId,
        incomeId: src.source === 'income' ? src.incomeId : undefined,
      };
      await db.deviations.update(d.id, { repayments: [...(d.repayments ?? []), rep] });
      rest = round2(rest - part);
    }
    return pay;
  });
}

async function removeRepayments(match: (r: Repayment) => boolean) {
  const all = await db.deviations.toArray();
  for (const d of all) {
    const reps = d.repayments ?? [];
    if (reps.some(match)) await db.deviations.update(d.id, { repayments: reps.filter((r) => !match(r)) });
  }
}

// ---------- Закрытие периода ----------

export type CloseChoice =
  | { kind: 'none' }
  | { kind: 'to_jar'; jarId: string }
  | { kind: 'deviation' }
  | { kind: 'covered_from_jar'; jarId: string }
  | { kind: 'carried_over' }
  /** Автоматически: излишки — в указанную копилку, перерасход — в список перерасхода. */
  | { kind: 'auto'; surplusJarId?: string };

export interface CloseResult {
  record: ClosedPeriod;
  categoryName: string;
  categoryIcon: string;
  jarName?: string;
}

/**
 * Закрывает текущий период статьи:
 * сохраняет запись в архив, обрабатывает излишки/перерасход и сдвигает начало периода
 * на следующее «естественное» начало (неделя / месяц с дня из настроек / квартал / год).
 * Досрочное закрытие подводит итог сразу; новый период всё равно начнётся в свой срок.
 * С onlyIfExpired: true закрывает только уже закончившийся период (для автозакрытия),
 * иначе ничего не делает и возвращает null.
 */
export async function closePeriod(
  categoryId: string,
  choice: CloseChoice,
  opts: { onlyIfExpired?: boolean; auto?: boolean } = {},
): Promise<CloseResult | null> {
  const { monthStartDay } = await getSettings();
  return db.transaction(
    'rw',
    [db.categories, db.expenses, db.closedPeriods, db.deviations, db.jarOperations, db.jars],
    async () => {
      const cat = await db.categories.get(categoryId);
      if (!cat) throw new Error('Статья не найдена');
      const expenses = (await db.expenses.where('categoryId').equals(categoryId).toArray()).filter((e) => !e.planned);
      const st = categoryStats(cat, expenses, monthStartDay);
      if (opts.onlyIfExpired && !st.expired) return null;
      if (st.notStarted) throw new Error('Этот период ещё не начался');
      const t = today();
      const end = st.range.end;
      // Считаем только операции внутри закрываемого периода.
      const spent = round2(
        expenses.filter((e) => e.date >= st.range.start && e.date <= end).reduce((a, e) => a + e.amount, 0),
      );
      const diff = round2(st.effectiveLimit - spent);
      if (choice.kind === 'auto') {
        choice =
          diff > 0 && choice.surplusJarId
            ? { kind: 'to_jar', jarId: choice.surplusJarId }
            : diff < 0
              ? { kind: 'deviation' }
              : { kind: 'none' };
      }

      let resolution: Resolution = 'none';
      let jarId: string | undefined;
      let carryOver = 0;

      if (choice.kind === 'to_jar' && diff > 0) {
        resolution = 'to_jar';
        jarId = choice.jarId;
        await addJarOperation({
          jarId,
          type: 'deposit',
          amount: diff,
          date: end < t ? end : t,
          note: '',
          source: `Излишки по статье «${cat.name}»`,
        });
      } else if (choice.kind === 'deviation' && diff < 0) {
        resolution = 'deviation';
        await db.deviations.add({
          id: uid(),
          categoryId,
          periodStart: st.range.start,
          periodEnd: end,
          amount: -diff,
          createdAt: Date.now(),
        });
      } else if (choice.kind === 'covered_from_jar' && diff < 0) {
        resolution = 'covered_from_jar';
        jarId = choice.jarId;
        await addJarOperation({
          jarId,
          type: 'withdraw',
          amount: -diff,
          date: end < t ? end : t,
          note: '',
          source: `Покрытие перерасхода по статье «${cat.name}»`,
        });
      } else if (choice.kind === 'carried_over' && diff < 0) {
        resolution = 'carried_over';
        carryOver = -diff;
      }

      const record: ClosedPeriod = {
        id: uid(),
        categoryId,
        start: st.range.start,
        end,
        limit: st.effectiveLimit,
        spent,
        difference: diff,
        resolution,
        jarId,
        auto: opts.auto || undefined,
        createdAt: Date.now(),
      };
      await db.closedPeriods.add(record);
      await db.categories.update(categoryId, {
        currentPeriodStart: addDays(end, 1),
        carryOver,
      });
      const jar = jarId ? await db.jars.get(jarId) : undefined;
      return { record, categoryName: cat.name, categoryIcon: cat.icon, jarName: jar?.name };
    },
  );
}
