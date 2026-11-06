// Модели данных приложения. Даты хранятся строкой 'YYYY-MM-DD' (локальная дата),
// createdAt — отметка времени в миллисекундах.

export type Period = 'week' | 'month' | 'quarter' | 'year';

export interface Category {
  id: string;
  name: string;
  icon: string;
  limit: number;
  period: Period;
  currentPeriodStart: string;
  /**
   * Поправка лимита текущего периода: положительная — перенесённый перерасход (уменьшает лимит),
   * отрицательная — пополнение из копилки (увеличивает лимит).
   */
  carryOver: number;
  order: number;
  archived: boolean;
}

export interface Expense {
  id: string;
  categoryId: string;
  title: string;
  amount: number;
  date: string;
  createdAt: number;
}

export interface Jar {
  id: string;
  name: string;
  icon: string;
  goalAmount: number;
  targetDate?: string;
  order: number;
  archived: boolean;
}

export type JarOperationType = 'deposit' | 'withdraw';

/** Куда ушли деньги, снятые из копилки (чтобы при удалении операции всё откатить). */
export type JarOperationLink =
  | { kind: 'topup'; categoryId: string } // пополнили лимит статьи
  | { kind: 'repay' }; // погасили перерасход

export interface JarOperation {
  id: string;
  jarId: string;
  type: JarOperationType;
  amount: number;
  date: string;
  note: string;
  source?: string;
  link?: JarOperationLink;
  createdAt: number;
}

export interface Income {
  id: string;
  title: string;
  amount: number;
  date: string;
  createdAt: number;
}

export type Resolution = 'to_jar' | 'deviation' | 'covered_from_jar' | 'carried_over' | 'none';

export interface ClosedPeriod {
  id: string;
  categoryId: string;
  start: string;
  end: string;
  limit: number;
  spent: number;
  difference: number;
  resolution: Resolution;
  jarId?: string;
  /** Период закрыт автоматически по окончании срока. */
  auto?: boolean;
  createdAt: number;
}

/** Погашение перерасхода (полное или частичное). */
export interface Repayment {
  id: string;
  date: string;
  amount: number;
  /** jar — из копилки, income — из поступления, cash — из текущих денег. */
  source: 'jar' | 'income' | 'cash';
  jarId?: string;
  jarOpId?: string;
  incomeId?: string;
}

/** Перерасход (в коде исторически называется Deviation — «отклонение»). */
export interface Deviation {
  id: string;
  categoryId: string;
  periodStart: string;
  periodEnd: string;
  amount: number;
  repayments?: Repayment[];
  createdAt: number;
}

export type Theme = 'light' | 'dark' | 'system';

export interface AppSettings {
  key: 'app';
  theme: Theme;
  /** День месяца, с которого начинаются месячные периоды (1–28). */
  monthStartDay: number;
  /** Стартовые статьи и копилки уже созданы. */
  seeded: boolean;
  /** Период сводки на главном экране. */
  homeRange?: HomeRange;
}

export type HomeRange = 'month' | '3m' | '6m' | 'year';

export const PERIOD_LABELS: Record<Period, string> = {
  week: 'неделя',
  month: 'месяц',
  quarter: 'квартал',
  year: 'год',
};
