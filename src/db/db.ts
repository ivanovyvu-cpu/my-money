import Dexie, { type EntityTable } from 'dexie';
import type {
  AppSettings,
  Category,
  ClosedPeriod,
  Deviation,
  Expense,
  Income,
  Jar,
  JarOperation,
  QuickTemplate,
} from './types';

// Локальная база IndexedDB. Чтобы изменить структуру в будущем —
// добавить db.version(2).stores({...}).upgrade(...), старые данные сохранятся.
export const db = new Dexie('financial-analyst') as Dexie & {
  categories: EntityTable<Category, 'id'>;
  expenses: EntityTable<Expense, 'id'>;
  jars: EntityTable<Jar, 'id'>;
  jarOperations: EntityTable<JarOperation, 'id'>;
  incomes: EntityTable<Income, 'id'>;
  closedPeriods: EntityTable<ClosedPeriod, 'id'>;
  deviations: EntityTable<Deviation, 'id'>;
  settings: EntityTable<AppSettings, 'key'>;
  quickTemplates: EntityTable<QuickTemplate, 'id'>;
};

db.version(1).stores({
  categories: 'id, order, archived',
  expenses: 'id, categoryId, date, [categoryId+date]',
  jars: 'id, order, archived',
  jarOperations: 'id, jarId, date, type',
  incomes: 'id, date',
  closedPeriods: 'id, categoryId, end',
  deviations: 'id, categoryId, createdAt',
  settings: 'key',
});

// Версия 2: быстрые кнопки трат. Старые данные сохраняются как есть.
db.version(2).stores({
  quickTemplates: 'id, order',
});

/** Все таблицы с данными пользователя (для экспорта/импорта/сброса). */
export const DATA_TABLES = [
  'categories',
  'expenses',
  'jars',
  'jarOperations',
  'incomes',
  'closedPeriods',
  'deviations',
  'settings',
  'quickTemplates',
] as const;

export type DataTableName = (typeof DATA_TABLES)[number];

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
