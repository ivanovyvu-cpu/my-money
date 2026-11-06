import type { CloseResult } from '../db/actions';
import { formatRange } from '../lib/dates';
import { money, sum } from '../lib/format';
import { Sheet } from './ui/Sheet';
import { Button } from './ui/controls';

/** Сводка после автоматического закрытия периодов. */
export function AutoCloseSummary({ results, onClose }: { results: CloseResult[]; onClose: () => void }) {
  const saved = sum(results.filter((r) => r.record.difference > 0), (r) => r.record.difference);
  const over = sum(results.filter((r) => r.record.difference < 0), (r) => -r.record.difference);

  return (
    <Sheet open={results.length > 0} onClose={onClose} title="Периоды закрыты">
      <p className="mb-4 text-muted">
        Срок {results.length === 1 ? 'периода' : 'периодов'} подошёл к концу — итоги подведены автоматически.
        {saved > 0 && (
          <>
            {' '}
            Сэкономлено <b className="text-ok">{money(saved)}</b> — отличный результат!
          </>
        )}
      </p>
      <ul className="mb-5 flex flex-col gap-2">
        {results.map(({ record: r, categoryIcon, categoryName, jarName }) => (
          <li key={r.id} className="rounded-2xl bg-card-2 p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate font-medium">
                {categoryIcon} {categoryName}
              </span>
              <span className={`shrink-0 font-semibold ${r.difference < 0 ? 'text-over' : r.difference > 0 ? 'text-ok' : ''}`}>
                {r.difference > 0 ? '+' : r.difference < 0 ? '−' : ''}
                {money(Math.abs(r.difference))}
              </span>
            </div>
            <div className="mt-0.5 flex justify-between gap-2 text-xs text-muted">
              <span>{formatRange({ start: r.start, end: r.end })}</span>
              <span className="text-right">
                {r.resolution === 'to_jar'
                  ? `в копилку «${jarName ?? 'Излишки'}»`
                  : r.resolution === 'deviation'
                    ? 'в отклонения'
                    : r.difference === 0
                      ? 'ровно в лимит'
                      : 'без изменений'}
              </span>
            </div>
          </li>
        ))}
      </ul>
      {over > 0 && (
        <p className="mb-4 text-sm text-muted">
          Перерасход {money(over)} записан в отклонения — его видно на главном экране. Ничего страшного, просто учтём в
          следующих тратах.
        </p>
      )}
      <Button variant="primary" block onClick={onClose}>
        Понятно
      </Button>
    </Sheet>
  );
}
