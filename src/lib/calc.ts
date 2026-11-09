import type { Category, Expense, Jar, JarOperation, Period } from '../db/types';
import { daysBetweenInclusive, periodRange, today, type DateRange } from './dates';
import { round2, sum } from './format';

// Вычисляемые значения — никогда не хранятся в базе, всегда считаются из операций.

export interface CategoryStats {
  range: DateRange;
  /** Лимит с учётом перенесённого перерасхода. */
  effectiveLimit: number;
  spent: number;
  remaining: number;
  /** Доля потраченного от лимита (0..∞). */
  ratio: number;
  status: 'ok' | 'warn' | 'over';
  /** Период уже закончился, но не закрыт. */
  expired: boolean;
  /** Период ещё не начался (прошлый закрыли досрочно). */
  notStarted: boolean;
  daysLeft: number;
  /** Сколько можно тратить в день до конца периода (если остаток > 0). */
  perDay: number | null;
  /** Сумма запланированных трат до конца периода (включая просроченные). */
  plannedSum: number;
  /** Остаток после оплаты всех запланированных трат. */
  afterPlans: number;
}

/**
 * expenses — фактические траты; planned — запланированные (необязательно).
 */
export function categoryStats(
  cat: Category,
  expenses: Expense[],
  monthStartDay: number,
  planned: Expense[] = [],
): CategoryStats {
  // Период начинается с currentPeriodStart (он может быть позже «естественного» начала,
  // если прошлый период закрыли досрочно) и заканчивается на естественной границе.
  const natural = periodRange(cat.currentPeriodStart, cat.period, monthStartDay);
  const range = { start: cat.currentPeriodStart, end: natural.end };
  const spent = sum(
    expenses.filter((e) => e.categoryId === cat.id && e.date >= cat.currentPeriodStart),
    (e) => e.amount,
  );
  const effectiveLimit = round2(cat.limit - (cat.carryOver || 0));
  const remaining = round2(effectiveLimit - spent);
  const ratio = effectiveLimit > 0 ? spent / effectiveLimit : spent > 0 ? Infinity : 0;
  const status = remaining < 0 ? 'over' : ratio >= 0.8 && effectiveLimit > 0 ? 'warn' : 'ok';
  const t = today();
  const expired = t > range.end;
  const notStarted = t < range.start;
  const daysLeft = expired ? 0 : daysBetweenInclusive(t < range.start ? range.start : t, range.end);
  const perDay = remaining > 0 && daysLeft > 0 ? round2(remaining / daysLeft) : null;
  const plannedSum = sum(
    planned.filter((e) => e.categoryId === cat.id && e.date <= range.end),
    (e) => e.amount,
  );
  const afterPlans = round2(remaining - plannedSum);
  return { range, effectiveLimit, spent, remaining, ratio, status, expired, notStarted, daysLeft, perDay, plannedSum, afterPlans };
}

export interface JarStats {
  saved: number;
  left: number;
  ratio: number;
  reached: boolean;
  /** Сколько откладывать в месяц, чтобы успеть к дате цели. */
  perMonth: number | null;
}

export function jarBalance(jarId: string, ops: JarOperation[]): number {
  return round2(
    ops
      .filter((o) => o.jarId === jarId)
      .reduce((acc, o) => acc + (o.type === 'deposit' ? o.amount : -o.amount), 0),
  );
}

export function jarStats(jar: Jar, ops: JarOperation[], monthsLeft?: number): JarStats {
  const saved = jarBalance(jar.id, ops);
  const left = round2(Math.max(0, jar.goalAmount - saved));
  const ratio = jar.goalAmount > 0 ? saved / jar.goalAmount : 0;
  const reached = jar.goalAmount > 0 && saved >= jar.goalAmount;
  const perMonth = jar.targetDate && left > 0 && monthsLeft ? round2(left / monthsLeft) : null;
  return { saved, left, ratio, reached, perMonth };
}

/** Лимит, приведённый к месяцу (для сводки на главном экране). */
export function monthlyLimit(limit: number, period: Period): number {
  switch (period) {
    case 'week':
      return round2((limit * 52) / 12);
    case 'month':
      return limit;
    case 'quarter':
      return round2(limit / 3);
    case 'year':
      return round2(limit / 12);
  }
}

export function inRange(date: string, r: DateRange): boolean {
  return date >= r.start && date <= r.end;
}
