import { useState } from 'react';
import type { JarOperation, JarOperationType } from '../db/types';
import { archiveJar, deleteJar, deleteJarOperation, updateJar } from '../db/actions';
import { goBack } from '../hooks/useRoute';
import { useJar, useJarOperations } from '../hooks/useData';
import { jarStats } from '../lib/calc';
import { formatDate, monthsUntil } from '../lib/dates';
import { money } from '../lib/format';
import { Page, ScreenHeader } from '../components/layout';
import { Button, EmptyState, ProgressBar } from '../components/ui/controls';
import { Sheet } from '../components/ui/Sheet';
import { useFeedback } from '../components/ui/feedback';
import { JarForm, JarOpSheet } from '../components/jars';

export function JarDetail({ id }: { id: string }) {
  const jar = useJar(id);
  const ops = useJarOperations();
  const { confirm, toast } = useFeedback();
  const [opSheet, setOpSheet] = useState<{ open: boolean; type: JarOperationType; op?: JarOperation | null }>({
    open: false,
    type: 'deposit',
  });
  const [editOpen, setEditOpen] = useState(false);

  if (jar === undefined) return null;
  if (jar === null)
    return (
      <>
        <ScreenHeader title="Копилка не найдена" back="/save" />
        <Page>
          <EmptyState>Возможно, она была удалена.</EmptyState>
        </Page>
      </>
    );

  const st = jarStats(jar, ops, jar.targetDate ? monthsUntil(jar.targetDate) : undefined);
  const list = ops.filter((o) => o.jarId === jar.id).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);

  async function onDelete(o: JarOperation) {
    if (
      await confirm({
        title: 'Удалить операцию?',
        message: `${o.type === 'deposit' ? 'Взнос' : 'Снятие'} ${money(o.amount)} от ${formatDate(o.date)}`,
        confirmText: 'Удалить',
        danger: true,
      })
    ) {
      await deleteJarOperation(o.id);
      toast('Операция удалена');
    }
  }

  return (
    <>
      <ScreenHeader
        title={`${jar.icon} ${jar.name}`}
        back="/save"
        right={
          <button type="button" onClick={() => setEditOpen(true)} className="h-11 rounded-full px-3 text-sm font-medium text-muted hover:bg-card-2">
            Изменить
          </button>
        }
      />
      <Page>
        <section className="rounded-[20px] bg-card p-4 shadow-soft">
          <div className="text-sm text-muted">Накоплено</div>
          <div className="text-4xl font-bold text-save">{money(st.saved)}</div>
          {jar.goalAmount > 0 && (
            <>
              <div className="mt-3">
                <ProgressBar ratio={st.ratio} status="save" />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-muted">Цель</div>
                  <div className="text-lg font-semibold">{money(jar.goalAmount)}</div>
                </div>
                <div>
                  <div className="text-muted">Осталось</div>
                  <div className="text-lg font-semibold">{st.reached ? 'Достигнута 🎉' : money(st.left)}</div>
                </div>
              </div>
            </>
          )}
          {jar.targetDate && (
            <div className="mt-3 rounded-xl bg-save-soft px-3 py-2 text-sm">
              Цель к {formatDate(jar.targetDate)}
              {st.perMonth && (
                <>
                  {' '}· откладывать ~<b>{money(Math.ceil(st.perMonth))}</b> в месяц
                </>
              )}
            </div>
          )}
        </section>

        <div className="mt-4 flex gap-2">
          <Button variant="save" className="flex-[2]" onClick={() => setOpSheet({ open: true, type: 'deposit' })}>
            + Внести
          </Button>
          <Button variant="soft" className="flex-1" disabled={st.saved <= 0} onClick={() => setOpSheet({ open: true, type: 'withdraw' })}>
            − Снять
          </Button>
        </div>

        <h2 className="mb-2 mt-6 font-semibold">История</h2>
        {list.length === 0 && <EmptyState>Пока нет операций</EmptyState>}
        <ul className="flex flex-col gap-2">
          {list.map((o) => (
            <li key={o.id} className="animate-pop-in flex items-center gap-2 rounded-2xl bg-card p-2 pl-4 shadow-soft">
              <button
                type="button"
                className="min-h-11 min-w-0 flex-1 text-left"
                onClick={() => setOpSheet({ open: true, type: o.type, op: o })}
              >
                <div className="truncate font-medium">{o.source || o.note || (o.type === 'deposit' ? 'Взнос' : 'Снятие')}</div>
                <div className="truncate text-xs text-muted">
                  {formatDate(o.date)}
                  {o.source && o.note ? ` · ${o.note}` : ''}
                </div>
              </button>
              <span className={`font-semibold ${o.type === 'deposit' ? 'text-save' : 'text-over'}`}>
                {o.type === 'deposit' ? '+' : '−'}
                {money(o.amount)}
              </span>
              <button
                type="button"
                aria-label="Удалить"
                onClick={() => onDelete(o)}
                className="flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-card-2"
              >
                🗑
              </button>
            </li>
          ))}
        </ul>
      </Page>

      <JarOpSheet open={opSheet.open} type={opSheet.type} op={opSheet.op} jarId={jar.id} onClose={() => setOpSheet({ ...opSheet, open: false })} />

      <Sheet open={editOpen} onClose={() => setEditOpen(false)} title="Редактировать копилку">
        {editOpen && (
          <>
            <JarForm
              initial={jar}
              submitText="Сохранить"
              onSubmit={async (v) => {
                await updateJar(jar.id, { ...v, targetDate: v.targetDate });
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
                      title: 'Архивировать копилку?',
                      message: 'Она пропадёт из списка, история сохранится. Вернуть можно в настройках.',
                      confirmText: 'В архив',
                    })
                  ) {
                    await archiveJar(jar.id);
                    setEditOpen(false);
                    goBack('/save');
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
                      title: 'Удалить копилку навсегда?',
                      message: `Вместе с ней удалится вся история операций (накоплено ${money(st.saved)}). Отменить нельзя.`,
                      confirmText: 'Удалить навсегда',
                      danger: true,
                    })
                  ) {
                    setEditOpen(false);
                    goBack('/save');
                    await deleteJar(jar.id);
                    toast('Копилка удалена');
                  }
                }}
              >
                Удалить копилку
              </Button>
            </div>
          </>
        )}
      </Sheet>
    </>
  );
}
