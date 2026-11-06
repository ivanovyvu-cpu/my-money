import { useState } from 'react';
import type { Expense } from '../db/types';
import { PERIOD_LABELS } from '../db/types';
import { archiveCategory, deleteCategory, deleteExpense, updateCategory } from '../db/actions';
import { goBack } from '../hooks/useRoute';
import { useCategory, useClosedPeriods, useExpenses, useSettings } from '../hooks/useData';
import { categoryStats } from '../lib/calc';
import { formatDate, formatRange } from '../lib/dates';
import { money, plural } from '../lib/format';
import { Page, ScreenHeader } from '../components/layout';
import { Button, EmptyState, ProgressBar } from '../components/ui/controls';
import { Sheet } from '../components/ui/Sheet';
import { useFeedback } from '../components/ui/feedback';
import { CategoryForm } from '../components/categories';
import { ExpenseSheet } from '../components/ExpenseSheet';
import { ClosePeriodSheet } from '../components/ClosePeriodSheet';

const RESOLUTION_LABEL = {
  to_jar: 'в копилку',
  deviation: 'в отклонения',
  covered_from_jar: 'покрыто из копилки',
  carried_over: 'перенесено',
  none: '',
} as const;

export function CategoryDetail({ id }: { id: string }) {
  const cat = useCategory(id);
  const expenses = useExpenses();
  const closed = useClosedPeriods();
  const { monthStartDay } = useSettings();
  const { confirm, toast } = useFeedback();
  const [expenseSheet, setExpenseSheet] = useState<{ open: boolean; expense?: Expense | null }>({ open: false });
  const [editOpen, setEditOpen] = useState(false);
  const [closeQueue, setCloseQueue] = useState<string[]>([]);
  const [showArchive, setShowArchive] = useState(false);

  if (cat === undefined) return null; // загрузка
  if (cat === null)
    return (
      <>
        <ScreenHeader title="Статья не найдена" back="/spend" />
        <Page>
          <EmptyState>Возможно, она была удалена.</EmptyState>
        </Page>
      </>
    );

  const st = categoryStats(cat, expenses, monthStartDay);
  const current = expenses
    .filter((e) => e.categoryId === cat.id && e.date >= cat.currentPeriodStart)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const history = closed.filter((p) => p.categoryId === cat.id).sort((a, b) => b.end.localeCompare(a.end));

  async function onDelete(e: Expense) {
    if (await confirm({ title: 'Удалить операцию?', message: `${e.title} · ${money(e.amount)}`, confirmText: 'Удалить', danger: true })) {
      await deleteExpense(e.id);
      toast('Операция удалена');
    }
  }

  return (
    <>
      <ScreenHeader
        title={`${cat.icon} ${cat.name}`}
        back="/spend"
        right={
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="h-11 rounded-full px-3 text-sm font-medium text-muted hover:bg-card-2"
          >
            Изменить
          </button>
        }
      />
      <Page>
        <section className="rounded-[20px] bg-card p-4 shadow-soft">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted">{st.remaining < 0 ? 'Перерасход' : 'Остаток'}</span>
            <span className="text-sm text-muted">
              {PERIOD_LABELS[cat.period]} · {formatRange(st.range)}
            </span>
          </div>
          <div className={`text-4xl font-bold ${st.remaining < 0 ? 'text-over' : ''}`}>{money(Math.abs(st.remaining))}</div>
          <div className="mt-3">
            <ProgressBar ratio={st.ratio} status={st.status} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-muted">Потрачено</div>
              <div className="text-lg font-semibold">{money(st.spent)}</div>
            </div>
            <div>
              <div className="text-muted">Лимит</div>
              <div className="text-lg font-semibold">{money(st.effectiveLimit)}</div>
              {cat.carryOver > 0 && (
                <div className="text-xs text-muted">
                  {money(cat.limit)} − перенос {money(cat.carryOver)}
                </div>
              )}
            </div>
          </div>
          {st.perDay !== null && (
            <div className="mt-3 rounded-xl bg-spend-soft px-3 py-2 text-sm">
              В день можно тратить <b>{money(Math.floor(st.perDay))}</b> · ещё {st.daysLeft} {plural(st.daysLeft, ['день', 'дня', 'дней'])}
            </div>
          )}
          {st.expired && <div className="mt-3 rounded-xl bg-warn/15 px-3 py-2 text-sm font-medium">⏰ Период завершён — пора закрыть</div>}
        </section>

        <div className="mt-4 flex gap-2">
          <Button variant="spend" className="flex-[2]" onClick={() => setExpenseSheet({ open: true })}>
            + Добавить операцию
          </Button>
          <Button variant={st.expired ? 'primary' : 'soft'} className="flex-1 text-sm" onClick={() => setCloseQueue([cat.id])}>
            Закрыть период
          </Button>
        </div>

        <h2 className="mb-2 mt-6 font-semibold">Операции периода</h2>
        {current.length === 0 && <EmptyState>Пока нет операций</EmptyState>}
        <ul className="flex flex-col gap-2">
          {current.map((e) => (
            <li key={e.id} className="animate-pop-in flex items-center gap-2 rounded-2xl bg-card p-2 pl-4 shadow-soft">
              <button type="button" className="min-h-11 min-w-0 flex-1 text-left" onClick={() => setExpenseSheet({ open: true, expense: e })}>
                <div className="truncate font-medium">{e.title}</div>
                <div className="text-xs text-muted">{formatDate(e.date)}</div>
              </button>
              <span className="font-semibold">−{money(e.amount)}</span>
              <button
                type="button"
                aria-label="Удалить"
                onClick={() => onDelete(e)}
                className="flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-card-2"
              >
                🗑
              </button>
            </li>
          ))}
        </ul>
        {current.length > 0 && <p className="mt-2 text-center text-xs text-muted">Нажмите на операцию, чтобы изменить её</p>}

        {history.length > 0 && (
          <>
            <button
              type="button"
              className="mt-6 flex min-h-11 w-full items-center justify-between font-semibold"
              onClick={() => setShowArchive(!showArchive)}
            >
              <span>Прошлые периоды ({history.length})</span>
              <span className={`transition-transform ${showArchive ? 'rotate-90' : ''}`}>›</span>
            </button>
            {showArchive && (
              <ul className="flex flex-col gap-2">
                {history.map((p) => (
                  <li key={p.id} className="rounded-2xl bg-card p-3 text-sm shadow-soft">
                    <div className="flex justify-between">
                      <span className="text-muted">{formatRange({ start: p.start, end: p.end })}</span>
                      <span className={`font-semibold ${p.difference < 0 ? 'text-over' : 'text-ok'}`}>
                        {p.difference >= 0 ? '+' : '−'}
                        {money(Math.abs(p.difference))}
                      </span>
                    </div>
                    <div className="mt-1 flex justify-between text-xs text-muted">
                      <span>
                        {money(p.spent)} из {money(p.limit)}
                      </span>
                      <span>{RESOLUTION_LABEL[p.resolution]}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Page>

      <ExpenseSheet
        open={expenseSheet.open}
        expense={expenseSheet.expense}
        categoryId={cat.id}
        onClose={() => setExpenseSheet({ open: false })}
      />
      <ClosePeriodSheet queue={closeQueue} onClose={() => setCloseQueue([])} />

      <Sheet open={editOpen} onClose={() => setEditOpen(false)} title="Редактировать статью">
        {editOpen && (
          <>
            <CategoryForm
              initial={cat}
              submitText="Сохранить"
              onSubmit={async (v) => {
                if (v.period !== cat.period) {
                  const ok = await confirm({
                    title: 'Сменить периодичность?',
                    message: 'Текущий период начнётся заново с начала новой периодичности. Операции не удаляются.',
                    confirmText: 'Сменить',
                  });
                  if (!ok) return;
                }
                await updateCategory(cat.id, v);
                setEditOpen(false);
                toast('Сохранено');
              }}
            />
            <div className="mt-6 flex flex-col gap-2 border-t border-line pt-4">
              <Button
                variant="soft"
                block
                onClick={async () => {
                  if (
                    await confirm({
                      title: 'Архивировать статью?',
                      message: 'Она пропадёт из списка, но история и операции сохранятся. Вернуть можно в настройках.',
                      confirmText: 'В архив',
                    })
                  ) {
                    await archiveCategory(cat.id);
                    setEditOpen(false);
                    toast('Статья в архиве');
                    goBack('/spend');
                  }
                }}
              >
                🗄 Архивировать
              </Button>
              <Button
                variant="ghost"
                block
                className="text-over"
                onClick={async () => {
                  if (
                    await confirm({
                      title: 'Удалить статью навсегда?',
                      message: 'Будут удалены все операции, история периодов и отклонения этой статьи. Отменить нельзя.',
                      confirmText: 'Удалить навсегда',
                      danger: true,
                    })
                  ) {
                    setEditOpen(false);
                    goBack('/spend');
                    await deleteCategory(cat.id);
                    toast('Статья удалена');
                  }
                }}
              >
                Удалить статью
              </Button>
            </div>
          </>
        )}
      </Sheet>
    </>
  );
}
