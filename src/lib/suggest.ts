import type { Expense, QuickTemplate } from '../db/types';
import { addDays, today } from './dates';

export interface Suggestion {
  title: string;
  categoryId: string;
  /** Есть, если трата почти всегда на одну и ту же сумму. */
  amount?: number;
  count: number;
}

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Предложения быстрых кнопок по истории: траты с одинаковым названием в одной статье,
 * которые встречались 3+ раза за последние 4 месяца. Уже сохранённые кнопки не предлагаются.
 */
export function suggestTemplates(expenses: Expense[], templates: QuickTemplate[], limit = 4): Suggestion[] {
  const since = addDays(today(), -120);
  const taken = new Set(templates.map((t) => `${t.categoryId}|${norm(t.title)}`));
  const groups = new Map<string, Expense[]>();
  for (const e of expenses) {
    if (e.planned || e.date < since || !e.title.trim()) continue;
    const key = `${e.categoryId}|${norm(e.title)}`;
    if (taken.has(key)) continue;
    const list = groups.get(key) ?? [];
    list.push(e);
    groups.set(key, list);
  }
  const out: Suggestion[] = [];
  for (const list of groups.values()) {
    if (list.length < 3) continue;
    // Самая частая сумма; если она в 60%+ случаев — кнопка сразу с суммой.
    const freq = new Map<number, number>();
    for (const e of list) freq.set(e.amount, (freq.get(e.amount) ?? 0) + 1);
    const [topAmount, topCount] = [...freq.entries()].sort((a, b) => b[1] - a[1])[0];
    const latest = [...list].sort((a, b) => b.date.localeCompare(a.date))[0];
    out.push({
      title: latest.title.trim(),
      categoryId: latest.categoryId,
      amount: topCount / list.length >= 0.6 ? topAmount : undefined,
      count: list.length,
    });
  }
  return out.sort((a, b) => b.count - a.count).slice(0, limit);
}
