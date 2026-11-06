import { deleteDeviation } from '../db/actions';
import { useCategories, useDeviations } from '../hooks/useData';
import { formatRange } from '../lib/dates';
import { money, sum } from '../lib/format';
import { Sheet } from './ui/Sheet';
import { EmptyState } from './ui/controls';
import { useFeedback } from './ui/feedback';

/** Список отклонений (перерасходов), записанных при закрытии периодов. */
export function DeviationsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const deviations = useDeviations();
  const categories = useCategories(true);
  const { confirm } = useFeedback();
  const list = [...deviations].sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));

  return (
    <Sheet open={open} onClose={onClose} title={`Отклонения · ${money(sum(deviations, (d) => d.amount))}`}>
      <p className="mb-3 text-sm text-muted">
        Это перерасходы прошлых периодов. Когда учтёте их (например, сократите траты), отметьте как решённые.
      </p>
      {list.length === 0 && <EmptyState>Отклонений нет 🎉</EmptyState>}
      <ul className="flex flex-col gap-2">
        {list.map((d) => {
          const c = categories.find((x) => x.id === d.categoryId);
          return (
            <li key={d.id} className="flex items-center gap-3 rounded-2xl bg-card-2 p-3">
              <span className="text-2xl">{c?.icon ?? '❔'}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{c?.name ?? 'Удалённая статья'}</div>
                <div className="text-xs text-muted">{formatRange({ start: d.periodStart, end: d.periodEnd })}</div>
              </div>
              <span className="font-semibold text-over">{money(d.amount)}</span>
              <button
                type="button"
                aria-label="Отметить как решённое"
                className="flex h-11 w-11 items-center justify-center rounded-full text-lg hover:bg-card"
                onClick={async () => {
                  if (
                    await confirm({
                      title: 'Отметить как решённое?',
                      message: `Отклонение ${money(d.amount)} исчезнет из списка.`,
                      confirmText: 'Да, решено',
                    })
                  )
                    await deleteDeviation(d.id);
                }}
              >
                ✓
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
