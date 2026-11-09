import { useState } from 'react';
import type { Expense } from '../db/types';
import { deleteExpense, markPlannedPaid } from '../db/actions';
import { useCategories, usePlannedExpenses } from '../hooks/useData';
import { formatDate, today } from '../lib/dates';
import { money, sum } from '../lib/format';
import { ExpenseSheet } from './ExpenseSheet';
import { Sheet } from './ui/Sheet';
import { EmptyState } from './ui/controls';
import { useFeedback } from './ui/feedback';

/** Список запланированных трат с кнопками «Оплачено», правкой и удалением. */
export function PlannedList({ categoryId, onlyDue }: { categoryId?: string; onlyDue?: boolean }) {
  const planned = usePlannedExpenses();
  const categories = useCategories(true);
  const { confirm, toast } = useFeedback();
  const [edit, setEdit] = useState<Expense | null>(null);
  const t = today();
  const list = planned.filter((e) => (!categoryId || e.categoryId === categoryId) && (!onlyDue || e.date <= t));

  if (list.length === 0) return <EmptyState>Запланированных трат нет</EmptyState>;

  return (
    <>
      <ul className="flex flex-col gap-2">
        {list.map((e) => {
          const c = categories.find((x) => x.id === e.categoryId);
          const overdue = e.date < t;
          const dueToday = e.date === t;
          return (
            <li key={e.id} className="animate-pop-in rounded-2xl border border-dashed border-line bg-card p-2 pl-4">
              <div className="flex items-center gap-2">
                <button type="button" className="min-h-11 min-w-0 flex-1 text-left" onClick={() => setEdit(e)}>
                  <div className="truncate font-medium">
                    {!categoryId && `${c?.icon ?? ''} `}
                    {e.title}
                  </div>
                  <div className={`text-xs ${overdue ? 'font-semibold text-over' : dueToday ? 'font-semibold text-warn' : 'text-muted'}`}>
                    📌 {overdue ? `просрочено · ${formatDate(e.date)}` : dueToday ? 'сегодня' : formatDate(e.date)}
                  </div>
                </button>
                <span className="font-semibold text-muted">{money(e.amount)}</span>
                <button
                  type="button"
                  aria-label="Удалить план"
                  className="flex h-11 w-9 items-center justify-center rounded-full text-muted hover:bg-card-2"
                  onClick={async () => {
                    if (await confirm({ title: 'Удалить план?', message: `${e.title} · ${money(e.amount)}`, confirmText: 'Удалить', danger: true })) {
                      await deleteExpense(e.id);
                    }
                  }}
                >
                  🗑
                </button>
              </div>
              <button
                type="button"
                className="mb-1 mr-2 mt-1 min-h-10 w-[calc(100%-8px)] rounded-xl bg-spend-soft text-sm font-semibold transition-transform duration-150 active:scale-[0.98]"
                onClick={async () => {
                  await markPlannedPaid(e.id);
                  toast(`Оплачено: ${money(e.amount)}`);
                }}
              >
                ✓ Оплачено
              </button>
            </li>
          );
        })}
      </ul>
      <ExpenseSheet open={!!edit} expense={edit} onClose={() => setEdit(null)} />
    </>
  );
}

/** Окно со списком планов (с главного экрана). */
export function PlannedSheet({ open, onClose, onlyDue }: { open: boolean; onClose: () => void; onlyDue?: boolean }) {
  const planned = usePlannedExpenses();
  const t = today();
  const total = sum(planned.filter((e) => !onlyDue || e.date <= t), (e) => e.amount);
  return (
    <Sheet open={open} onClose={onClose} title={`${onlyDue ? 'Пора оплатить' : 'Запланировано'} · ${money(total)}`}>
      <p className="mb-3 text-sm text-muted">
        Когда трата состоится — нажмите «Оплачено», и она попадёт в расходы сегодняшним числом. Сумму можно поправить,
        нажав на план.
      </p>
      <PlannedList onlyDue={onlyDue} />
    </Sheet>
  );
}
