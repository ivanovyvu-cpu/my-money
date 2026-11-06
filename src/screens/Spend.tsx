import { useState } from 'react';
import { addCategory } from '../db/actions';
import { navigate } from '../hooks/useRoute';
import { useCategories, useExpenses, useSettings } from '../hooks/useData';
import { categoryStats } from '../lib/calc';
import { money, sum } from '../lib/format';
import { Page, ScreenHeader } from '../components/layout';
import { AddTile, CategoryForm, CategoryTile } from '../components/categories';
import { ClosePeriodSheet } from '../components/ClosePeriodSheet';
import { useFeedback } from '../components/ui/feedback';

export function Spend() {
  const categories = useCategories();
  const expenses = useExpenses();
  const { monthStartDay } = useSettings();
  const { toast } = useFeedback();
  const [adding, setAdding] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [queue, setQueue] = useState<string[]>([]);

  const rows = categories.map((c) => ({ cat: c, st: categoryStats(c, expenses, monthStartDay) }));
  const expired = rows.filter((r) => r.st.expired).map((r) => r.cat.id);
  const totalLeft = sum(rows, (r) => r.st.remaining);

  return (
    <>
      <ScreenHeader title="👛 Потратить" back="/" accent="spend" />
      <Page>
        <p className="mb-3 text-sm text-muted">
          Остаток по всем статьям: <b className={totalLeft < 0 ? 'text-over' : 'text-text'}>{money(totalLeft)}</b>
        </p>

        {expired.length > 0 && (
          <button
            type="button"
            onClick={() => setQueue(expired)}
            className="mb-3 flex min-h-12 w-full items-center justify-between rounded-2xl bg-warn/15 px-4 py-3 text-left font-semibold"
          >
            <span>⏰ Закрыть период для всех статей ({expired.length})</span>
            <span className="text-xl">›</span>
          </button>
        )}

        <div className="flex flex-col gap-3">
          {rows.map(({ cat, st }) => (
            <CategoryTile key={cat.id} cat={cat} st={st} onClick={() => navigate(`/spend/${cat.id}`)} />
          ))}
          <AddTile
            label="Добавить статью расходов"
            accent="spend"
            open={adding}
            onToggle={(v) => {
              setAdding(v);
              if (v) setFormKey((k) => k + 1);
            }}
          >
            <CategoryForm
              key={formKey}
              submitText="Создать"
              onCancel={() => setAdding(false)}
              onSubmit={async (v) => {
                await addCategory(v);
                setAdding(false);
                toast(`Статья «${v.name}» создана`);
              }}
            />
          </AddTile>
        </div>

        {expired.length === 0 && rows.length > 0 && (
          <p className="mt-4 text-center text-xs text-muted">
            Закрыть период досрочно можно в карточке статьи.
          </p>
        )}
      </Page>
      <ClosePeriodSheet queue={queue} onClose={() => setQueue([])} />
    </>
  );
}
