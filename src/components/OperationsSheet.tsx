import { useState } from 'react';
import type { Expense } from '../db/types';
import { useCategories } from '../hooks/useData';
import { categoryColor } from '../lib/colors';
import { formatDate } from '../lib/dates';
import { money, plural, sum } from '../lib/format';
import { ExpenseSheet } from './ExpenseSheet';
import { Sheet } from './ui/Sheet';
import { EmptyState } from './ui/controls';

/** Окно со списком операций, из которых сложилась цифра (например, в аналитике). */
export function OperationsSheet({
  open,
  onClose,
  title,
  subtitle,
  expenses,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  expenses: Expense[];
}) {
  const allCats = useCategories(true);
  const [edit, setEdit] = useState<Expense | null>(null);
  const list = [...expenses].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const total = sum(list, (e) => e.amount);
  // Если все операции из одной статьи — значок у каждой строки не нужен.
  const oneCat = list.every((e) => e.categoryId === list[0]?.categoryId);

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <p className="mb-3 text-sm text-muted">
        {subtitle ? `${subtitle} · ` : ''}
        {list.length} {plural(list.length, ['операция', 'операции', 'операций'])} на <b className="text-text">{money(total)}</b>
      </p>
      {list.length === 0 ? (
        <EmptyState>Операций нет</EmptyState>
      ) : (
        <ul className="flex flex-col">
          {list.map((e) => {
            const c = allCats.find((x) => x.id === e.categoryId);
            return (
              <li key={e.id} className="border-b border-line last:border-0">
                <button type="button" onClick={() => setEdit(e)} className="flex min-h-12 w-full items-center gap-3 py-2 text-left">
                  {!oneCat && (
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg"
                      style={{ background: `color-mix(in srgb, ${categoryColor(e.categoryId, allCats)} 22%, var(--card))` }}
                    >
                      {c?.icon ?? '❔'}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{e.title}</span>
                    <span className="block truncate text-xs text-muted">
                      {formatDate(e.date)}
                      {!oneCat && c ? ` · ${c.name}` : ''}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold">−{money(e.amount)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-center text-xs text-muted">Нажмите на операцию, чтобы изменить её</p>
      <ExpenseSheet open={!!edit} expense={edit} onClose={() => setEdit(null)} />
    </Sheet>
  );
}
