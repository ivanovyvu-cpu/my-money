import { db } from './db';
import { closePeriod, getSettings, SURPLUS_JAR_NAME, type CloseResult } from './actions';
import { categoryStats } from '../lib/calc';

// Автоматическое закрытие периодов, срок которых уже прошёл.
// Излишки уходят в копилку «Излишки», перерасход — в список перерасхода.

let running: Promise<CloseResult[]> | null = null;

/** Безопасно вызывать сколько угодно раз: параллельные вызовы ждут один и тот же проход. */
export function autoCloseExpired(): Promise<CloseResult[]> {
  if (!running) running = run().finally(() => (running = null));
  return running;
}

async function run(): Promise<CloseResult[]> {
  const results: CloseResult[] = [];
  const { monthStartDay } = await getSettings();
  // Если приложение долго не открывали, у статьи может накопиться несколько прошедших периодов —
  // закрываем по одному, пока все не станут актуальными (с ограничением на всякий случай).
  for (let guard = 0; guard < 500; guard++) {
    const categories = (await db.categories.toArray()).filter((c) => !c.archived);
    const expenses = await db.expenses.toArray();
    const target = categories.find((c) => categoryStats(c, expenses, monthStartDay).expired);
    if (!target) break;
    const jars = (await db.jars.toArray()).filter((j) => !j.archived);
    const surplusJarId = jars.find((j) => j.name === SURPLUS_JAR_NAME)?.id;
    const r = await closePeriod(target.id, { kind: 'auto', surplusJarId }, { onlyIfExpired: true, auto: true });
    if (r) results.push(r);
  }
  return results;
}
