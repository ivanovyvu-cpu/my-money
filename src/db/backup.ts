import { db, DATA_TABLES, type DataTableName } from './db';
import { today } from '../lib/dates';

// Резервная копия: все таблицы в одном JSON-файле.

const APP_ID = 'financial-analyst';
const BACKUP_VERSION = 1;

export interface BackupFile {
  app: typeof APP_ID;
  version: number;
  exportedAt: string;
  data: Record<DataTableName, unknown[]>;
}

export async function buildBackup(): Promise<BackupFile> {
  const data = {} as Record<DataTableName, unknown[]>;
  await db.transaction('r', DATA_TABLES.map((t) => db.table(t)), async () => {
    for (const t of DATA_TABLES) data[t] = await db.table(t).toArray();
  });
  return { app: APP_ID, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data };
}

export function backupFileName(): string {
  return `finance-backup-${today()}.json`;
}

/** Скачивает файл. На телефоне по возможности открывает меню «Поделиться» (удобно на iPhone). */
export async function exportToFile(): Promise<'shared' | 'downloaded'> {
  const backup = await buildBackup();
  const json = JSON.stringify(backup, null, 2);
  const name = backupFileName();
  const file = new File([json], name, { type: 'application/json' });

  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  const isTouch = matchMedia('(pointer: coarse)').matches;
  if (isTouch && nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e;
      // иначе — пробуем обычное скачивание
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return 'downloaded';
}

/** Проверяет файл и возвращает краткую сводку (сколько записей), не меняя данные. */
export function parseBackup(text: string): { backup: BackupFile; counts: Record<string, number> } {
  let obj: unknown;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new Error('Файл повреждён или это не JSON.');
  }
  const b = obj as Partial<BackupFile>;
  if (!b || b.app !== APP_ID || typeof b.data !== 'object' || !b.data) {
    throw new Error('Это не резервная копия «Финансового аналитика».');
  }
  if ((b.version ?? 0) > BACKUP_VERSION) {
    throw new Error('Файл создан более новой версией приложения. Обновите приложение.');
  }
  const counts: Record<string, number> = {};
  for (const t of DATA_TABLES) {
    const rows = (b.data as Record<string, unknown>)[t] ?? [];
    if (!Array.isArray(rows)) throw new Error(`Неверный формат раздела «${t}».`);
    for (const r of rows) {
      const key = t === 'settings' ? 'key' : 'id';
      if (!r || typeof r !== 'object' || !(key in r)) throw new Error(`Повреждённая запись в разделе «${t}».`);
    }
    counts[t] = rows.length;
  }
  return { backup: b as BackupFile, counts };
}

/** Полностью заменяет данные содержимым копии (в одной транзакции: либо всё, либо ничего). */
export async function restoreBackup(backup: BackupFile) {
  await db.transaction('rw', DATA_TABLES.map((t) => db.table(t)), async () => {
    for (const t of DATA_TABLES) {
      await db.table(t).clear();
      const rows = (backup.data[t] ?? []) as object[];
      if (rows.length) await db.table(t).bulkAdd(rows);
    }
    // Чтобы после восстановления не добавились стартовые статьи поверх данных.
    const s = await db.settings.get('app');
    if (!s) await db.settings.put({ key: 'app', theme: 'system', monthStartDay: 1, seeded: true });
    else if (!s.seeded) await db.settings.put({ ...s, seeded: true });
  });
}

export async function wipeAll() {
  await db.transaction('rw', DATA_TABLES.map((t) => db.table(t)), async () => {
    for (const t of DATA_TABLES) await db.table(t).clear();
  });
}
