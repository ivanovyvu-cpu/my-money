import { useState } from 'react';
import type { Deviation } from '../db/types';
import { deleteDeviation, deviationLeft, repayDeviations } from '../db/actions';
import { useCategories, useDeviations, useJarOperations, useJars } from '../hooks/useData';
import { jarBalance } from '../lib/calc';
import { formatRange, today } from '../lib/dates';
import { amountToInput, money, parseAmount, sum } from '../lib/format';
import { Sheet } from './ui/Sheet';
import { Button, Chips, EmptyState, Field, MoneyInput } from './ui/controls';
import { useFeedback } from './ui/feedback';

/** Список перерасходов, записанных при закрытии периодов, с возможностью погасить. */
export function DeviationsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const deviations = useDeviations();
  const categories = useCategories(true);
  const { confirm, toast } = useFeedback();
  // null — окно погашения закрыто; 'all' — гасим весь перерасход; иначе конкретная запись.
  const [repay, setRepay] = useState<Deviation | 'all' | null>(null);

  const list = deviations.filter((d) => deviationLeft(d) > 0).sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));
  const total = sum(list, deviationLeft);

  return (
    <>
      <Sheet open={open} onClose={onClose} title={`Перерасход · ${money(total)}`}>
        <p className="mb-3 text-sm text-muted">
          Здесь собран перерасход прошлых периодов. Погасите его из копилки или из текущих денег — полностью или частями.
        </p>
        {list.length === 0 && <EmptyState>Перерасхода нет 🎉</EmptyState>}
        {list.length > 1 && (
          <Button variant="save" block className="mb-3" onClick={() => setRepay('all')}>
            Погасить весь перерасход
          </Button>
        )}
        <ul className="flex flex-col gap-2">
          {list.map((d) => {
            const c = categories.find((x) => x.id === d.categoryId);
            const left = deviationLeft(d);
            return (
              <li key={d.id} className="rounded-2xl bg-card-2 p-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{c?.icon ?? '❔'}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{c?.name ?? 'Удалённая статья'}</div>
                    <div className="text-xs text-muted">{formatRange({ start: d.periodStart, end: d.periodEnd })}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-over">{money(left)}</div>
                    {left < d.amount && <div className="text-xs text-muted">из {money(d.amount)}</div>}
                  </div>
                </div>
                <div className="mt-2 flex gap-2">
                  <Button variant="save" className="min-h-11 flex-1 text-sm" onClick={() => setRepay(d)}>
                    Погасить
                  </Button>
                  <Button
                    variant="ghost"
                    className="min-h-11 px-3 text-sm text-muted"
                    onClick={async () => {
                      if (
                        await confirm({
                          title: 'Удалить запись о перерасходе?',
                          message: 'Подходит, если запись появилась по ошибке. Чтобы учесть деньги, лучше нажать «Погасить».',
                          confirmText: 'Удалить',
                          danger: true,
                        })
                      ) {
                        await deleteDeviation(d.id);
                        toast('Запись удалена');
                      }
                    }}
                  >
                    Удалить
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </Sheet>

      <Sheet open={repay !== null} onClose={() => setRepay(null)} title="Погасить перерасход">
        {repay !== null && (
          <RepayForm
            key={repay === 'all' ? 'all' : repay.id}
            target={repay}
            max={repay === 'all' ? total : deviationLeft(repay)}
            onDone={() => setRepay(null)}
          />
        )}
      </Sheet>
    </>
  );
}

const CASH = 'cash';

function RepayForm({ target, max, onDone }: { target: Deviation | 'all'; max: number; onDone: () => void }) {
  const jars = useJars();
  const ops = useJarOperations();
  const { toast } = useFeedback();
  const [amount, setAmount] = useState(amountToInput(max));
  const [src, setSrc] = useState<string>(CASH);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit() {
    const a = parseAmount(amount);
    if (Number.isNaN(a) || a <= 0) return setError('Введите сумму больше нуля');
    if (a > max) return setError(`Перерасхода всего ${money(max)}`);
    if (src !== CASH && a > jarBalance(src, ops)) return setError(`В копилке только ${money(jarBalance(src, ops))}`);
    setBusy(true);
    try {
      const paid = await repayDeviations(
        a,
        src === CASH ? { source: 'cash', date: today() } : { source: 'jar', jarId: src, date: today() },
        target === 'all' ? undefined : target.id,
      );
      toast(paid >= max ? 'Перерасход погашен 🎉' : `Погашено ${money(paid)}`);
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Field label={`Сумма (не больше ${money(max)})`} error={error}>
        <MoneyInput value={amount} onChange={setAmount} large />
      </Field>
      <div className="mb-5">
        <span className="mb-1.5 block text-sm font-medium text-muted">Откуда</span>
        <Chips
          accent="save"
          items={[
            { id: CASH, label: 'Из текущих денег', icon: '💵' },
            ...jars.map((j) => {
              const bal = jarBalance(j.id, ops);
              return { id: j.id, label: `${j.name} · ${money(bal)}`, icon: j.icon, disabled: bal <= 0 };
            }),
          ]}
          value={src}
          onChange={setSrc}
        />
        <p className="mt-2 text-xs text-muted">
          {src === CASH
            ? '«Из текущих денег» — сумма уменьшит «Свободно к распределению» в этом месяце.'
            : 'Сумма будет снята из выбранной копилки.'}
        </p>
      </div>
      <Button variant="save" block disabled={busy} onClick={submit}>
        Погасить
      </Button>
    </div>
  );
}
