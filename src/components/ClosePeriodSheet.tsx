import { useMemo, useState } from 'react';
import { closePeriod, SURPLUS_JAR_NAME, type CloseChoice } from '../db/actions';
import { categoryStats, jarBalance } from '../lib/calc';
import { formatRange, today } from '../lib/dates';
import { money } from '../lib/format';
import { EXACT_PHRASES, OVERSPEND_PHRASES, SURPLUS_PHRASES, pickPhrase } from '../lib/phrases';
import { useCategories, useExpenses, useJarOperations, useJars, useSettings } from '../hooks/useData';
import { Sheet } from './ui/Sheet';
import { Button, Chips } from './ui/controls';
import { useFeedback } from './ui/feedback';
import { launchConfetti } from './ui/confetti';

/**
 * Закрытие периода. Принимает очередь статей и проходит по ним по одной
 * (для одной статьи — очередь из одного элемента).
 */
export function ClosePeriodSheet({ queue, onClose }: { queue: string[]; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const open = queue.length > 0 && index < queue.length;
  const id = queue[index];
  const { toast } = useFeedback();

  function next() {
    if (index + 1 >= queue.length) {
      toast(queue.length > 1 ? 'Все периоды закрыты' : 'Период закрыт');
      setIndex(0);
      onClose();
    } else setIndex(index + 1);
  }

  function close() {
    setIndex(0);
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={close}
      title={queue.length > 1 ? `Закрытие периода · ${index + 1} из ${queue.length}` : 'Закрытие периода'}
    >
      {open && id && <CloseStep key={id} categoryId={id} onDone={next} />}
    </Sheet>
  );
}

function CloseStep({ categoryId, onDone }: { categoryId: string; onDone: () => void }) {
  const categories = useCategories();
  const expenses = useExpenses();
  const jars = useJars();
  const ops = useJarOperations();
  const { monthStartDay } = useSettings();
  const cat = categories.find((c) => c.id === categoryId);
  const surplusJar = jars.find((j) => j.name === SURPLUS_JAR_NAME) ?? jars[0];
  const [jarId, setJarId] = useState<string | null>(null);
  const [mode, setMode] = useState<'main' | 'cover'>('main');
  const [busy, setBusy] = useState(false);

  // Фразу выбираем один раз на шаг, чтобы она не менялась при перерисовке.
  const seed = useMemo(() => Math.random(), []);

  if (!cat) return <p className="py-6 text-center text-muted">Загрузка…</p>;
  const st = categoryStats(cat, expenses, monthStartDay);
  const end = st.expired ? st.range.end : today();
  const spent = expenses
    .filter((e) => e.categoryId === cat.id && e.date >= st.range.start && e.date <= end)
    .reduce((a, e) => a + e.amount, 0);
  const diff = Math.round((st.effectiveLimit - spent) * 100) / 100;
  const vars = { sum: money(Math.abs(diff)), name: cat.name };
  const pick = (list: string[]) => {
    const i = Math.floor(seed * list.length);
    return pickPhrase([list[i]], vars);
  };
  const selectedJar = jarId ?? surplusJar?.id ?? null;

  async function finish(choice: CloseChoice) {
    if (busy) return;
    setBusy(true);
    try {
      await closePeriod(categoryId, choice);
      if (choice.kind === 'to_jar') launchConfetti(50);
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-4 rounded-2xl bg-card-2 p-4">
        <div className="mb-1 font-semibold">
          {cat.icon} {cat.name}
        </div>
        <div className="text-sm text-muted">
          {formatRange({ start: st.range.start, end })}
          {!st.expired && ' · закрытие досрочно, новый период начнётся завтра'}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
          <div>
            <div className="text-muted">Лимит</div>
            <div className="font-semibold">{money(st.effectiveLimit)}</div>
          </div>
          <div>
            <div className="text-muted">Потрачено</div>
            <div className="font-semibold">{money(spent)}</div>
          </div>
          <div>
            <div className="text-muted">{diff < 0 ? 'Перерасход' : 'Осталось'}</div>
            <div className={`font-semibold ${diff < 0 ? 'text-over' : diff > 0 ? 'text-ok' : ''}`}>{money(Math.abs(diff))}</div>
          </div>
        </div>
      </div>

      {diff > 0 && (
        <>
          <p className="mb-1 text-lg font-semibold">{pick(SURPLUS_PHRASES)}</p>
          <p className="mb-3 text-muted">Куда положить излишки?</p>
          {jars.length > 0 ? (
            <div className="mb-5">
              <Chips accent="save" items={jars.map((j) => ({ id: j.id, label: j.name, icon: j.icon }))} value={selectedJar} onChange={setJarId} />
            </div>
          ) : (
            <p className="mb-5 text-sm text-muted">Копилок пока нет — создайте их в разделе «Накопить».</p>
          )}
          <div className="flex flex-col gap-2">
            <Button variant="save" block disabled={!selectedJar || busy} onClick={() => selectedJar && finish({ kind: 'to_jar', jarId: selectedJar })}>
              Положить {money(diff)}
            </Button>
            <Button variant="ghost" block disabled={busy} onClick={() => finish({ kind: 'none' })}>
              Оставить как есть
            </Button>
          </div>
        </>
      )}

      {diff === 0 && (
        <>
          <p className="mb-5 text-lg font-semibold">{pick(EXACT_PHRASES)}</p>
          <Button variant="primary" block disabled={busy} onClick={() => finish({ kind: 'none' })}>
            Закрыть период
          </Button>
        </>
      )}

      {diff < 0 && mode === 'main' && (
        <>
          <p className="mb-3 text-lg font-semibold">{pick(OVERSPEND_PHRASES)}</p>
          <p className="mb-4 text-muted">
            Перерасход: <b className="text-over">{money(-diff)}</b>. Что с ним сделать?
          </p>
          <div className="flex flex-col gap-2">
            <Button variant="soft" block disabled={busy} onClick={() => finish({ kind: 'deviation' })}>
              📝 Записать в отклонения
            </Button>
            <Button variant="soft" block disabled={busy || jars.length === 0} onClick={() => setMode('cover')}>
              🫙 Покрыть из копилки
            </Button>
            <Button variant="soft" block disabled={busy} onClick={() => finish({ kind: 'carried_over' })}>
              ↪️ Перенести на следующий период
            </Button>
            <p className="px-1 text-xs text-muted">При переносе лимит следующего периода уменьшится на {money(-diff)}.</p>
          </div>
        </>
      )}

      {diff < 0 && mode === 'cover' && (
        <>
          <p className="mb-3 text-muted">Из какой копилки покрыть {money(-diff)}?</p>
          <div className="mb-2">
            <Chips
              accent="save"
              items={jars.map((j) => {
                const bal = jarBalance(j.id, ops);
                return { id: j.id, label: `${j.name} · ${money(bal)}`, icon: j.icon, disabled: bal < -diff };
              })}
              value={jarId}
              onChange={setJarId}
            />
          </div>
          <p className="mb-5 text-xs text-muted">Недоступны копилки, где меньше нужной суммы.</p>
          <div className="flex flex-col gap-2">
            <Button variant="save" block disabled={!jarId || busy} onClick={() => jarId && finish({ kind: 'covered_from_jar', jarId })}>
              Покрыть
            </Button>
            <Button variant="ghost" block onClick={() => setMode('main')}>
              Назад
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
