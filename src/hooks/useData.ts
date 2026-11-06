import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { DEFAULT_SETTINGS } from '../db/actions';
import type { AppSettings } from '../db/types';

// Живые выборки из базы: экран обновляется сам при любом изменении данных.

const EMPTY: never[] = [];

export function useSettings(): AppSettings {
  return useLiveQuery(() => db.settings.get('app'), []) ?? DEFAULT_SETTINGS;
}

export function useCategories(includeArchived = false) {
  return (
    useLiveQuery(async () => {
      const all = await db.categories.orderBy('order').toArray();
      return includeArchived ? all : all.filter((c) => !c.archived);
    }, [includeArchived]) ?? EMPTY
  );
}

export function useCategory(id: string) {
  return useLiveQuery(async () => (await db.categories.get(id)) ?? null, [id]);
}

export function useExpenses() {
  return useLiveQuery(() => db.expenses.toArray(), []) ?? EMPTY;
}

export function useJars(includeArchived = false) {
  return (
    useLiveQuery(async () => {
      const all = await db.jars.orderBy('order').toArray();
      return includeArchived ? all : all.filter((j) => !j.archived);
    }, [includeArchived]) ?? EMPTY
  );
}

export function useJar(id: string) {
  return useLiveQuery(async () => (await db.jars.get(id)) ?? null, [id]);
}

export function useJarOperations() {
  return useLiveQuery(() => db.jarOperations.toArray(), []) ?? EMPTY;
}

export function useIncomes() {
  return useLiveQuery(() => db.incomes.toArray(), []) ?? EMPTY;
}

export function useClosedPeriods() {
  return useLiveQuery(() => db.closedPeriods.toArray(), []) ?? EMPTY;
}

export function useDeviations() {
  return useLiveQuery(() => db.deviations.toArray(), []) ?? EMPTY;
}
