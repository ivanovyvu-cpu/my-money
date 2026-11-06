import { useState } from 'react';
import type { Jar, JarOperation, JarOperationType } from '../db/types';
import { addJarOperation, deviationLeft, repayDeviations, topUpCategoryFromJar, updateJarOperation } from '../db/actions';
import { db } from '../db/db';
import { jarBalance, type JarStats } from '../lib/calc';
import { formatDate, today } from '../lib/dates';
import { amountToInput, money, parseAmount, sum } from '../lib/format';
import { useCategories, useDeviations, useJarOperations, useJars } from '../hooks/useData';
import { Button, Chips, DateInput, Field, MoneyInput, ProgressBar, TextInput } from './ui/controls';
import { EmojiPicker } from './ui/EmojiPicker';
import { Sheet } from './ui/Sheet';
import { useFeedback } from './ui/feedback';
import { launchConfetti } from './ui/confetti';

/** Плашка копилки в списке. */
export function JarTile({ jar, st, onClick }: { jar: Jar; st: JarStats; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="animate-pop-in block w-full rounded-[16px] bg-card p-4 text-left shadow-soft transition-transform duration-150 active:scale-[0.99]"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-save-soft text-2xl">{jar.icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate font-semibold">{jar.name}</span>
            <span className="shrink-0 text-lg font-bold">{money(st.saved)}</span>
          </div>
          <div className="flex justify-between text-sm text-muted">
            <span>{jar.goalAmount > 0 ? `цель ${money(jar.goalAmount)}` : 'без цели'}</span>
            {jar.goalAmount > 0 && <span>{st.reached ? 'цель достигнута 🎉' : `осталось ${money(st.left)}`}</span>}
          </div>
        </div>
      </div>
      {jar.goalAmount > 0 && (
        <div className="mt-3">
          <ProgressBar ratio={st.ratio} status="save" />
        </div>
      )}
      {(st.perMonth || jar.targetDate) && (
        <div className="mt-2 flex justify-between text-xs text-muted">
          {jar.targetDate && <span>к {formatDate(jar.targetDate)}</span>}
          {st.perMonth && <span>нужно откладывать ~{money(Math.ceil(st.perMonth))} в месяц</span>}
        </div>
      )}
    </button>
  );
}

export interface JarFormValue {
  name: string;
  icon: string;
  goalAmount: number;
  targetDate?: string;
}

export function JarForm({
  initial,
  submitText,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<JarFormValue>;
  submitText: string;
  onSubmit: (v: JarFormValue) => Promise<void> | void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [goal, setGoal] = useState(amountToInput(initial?.goalAmount ?? 0));
  const [targetDate, setTargetDate] = useState(initial?.targetDate ?? '');
  const [icon, setIcon] = useState(initial?.icon ?? '✨');
  const [errors, setErrors] = useState<{ name?: string; goal?: string; date?: string }>({});

  async function submit() {
    const e: typeof errors = {};
    if (!name.trim()) e.name = 'Введите название';
    const g = goal.trim() === '' ? 0 : parseAmount(goal);
    if (Number.isNaN(g) || g < 0) e.goal = 'Введите сумму числом, например 50 000';
    if (targetDate && targetDate <= today()) e.date = 'Дата цели должна быть в будущем';
    setErrors(e);
    if (Object.keys(e).length) return;
    await onSubmit({ name: name.trim(), icon, goalAmount: g, targetDate: targetDate || undefined });
  }

  return (
    <div>
      <Field label="Название" error={errors.name}>
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Например, Отпуск" maxLength={40} />
      </Field>
      <Field label="Сумма цели (0 — без цели)" error={errors.goal}>
        <MoneyInput value={goal} onChange={setGoal} />
      </Field>
      <Field label="Дата цели (необязательно)" error={errors.date}>
        <div className="flex gap-2">
          <DateInput value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          {targetDate && (
            <Button variant="soft" onClick={() => setTargetDate('')} aria-label="Убрать дату">
              ×
            </Button>
          )}
        </div>
      </Field>
      <div className="mb-5">
        <span className="mb-1.5 block text-sm font-medium text-muted">Иконка</span>
        <EmojiPicker value={icon} onChange={setIcon} kind="save" />
      </div>
      <div className="flex gap-2">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} className="flex-1">
            Отмена
          </Button>
        )}
        <Button variant="save" onClick={submit} className="flex-[2]">
          {submitText}
        </Button>
      </div>
    </div>
  );
}

const OUT = '__out';
const DEBT = '__debt';

/** Окно «Внести» / «Снять» (и редактирование операции копилки). */
export function JarOpSheet({
  open,
  onClose,
  type,
  jarId,
  op,
}: {
  open: boolean;
  onClose: () => void;
  type: JarOperationType;
  jarId?: string;
  op?: JarOperation | null;
}) {
  const t = op?.type ?? type;
  return (
    <Sheet open={open} onClose={onClose} title={op ? 'Изменить операцию' : t === 'deposit' ? 'Внести в копилку' : 'Снять из копилки'}>
      {open && <JarOpForm key={op?.id ?? t} type={t} jarId={op?.jarId ?? jarId} op={op} onDone={onClose} />}
    </Sheet>
  );
}

function JarOpForm({ type, jarId, op, onDone }: { type: JarOperationType; jarId?: string; op?: JarOperation | null; onDone: () => void }) {
  const jars = useJars();
  const ops = useJarOperations();
  const { toast } = useFeedback();
  const [amount, setAmount] = useState(op ? amountToInput(op.amount) : '');
  const [date, setDate] = useState(op?.date ?? today());
  const [selJar, setSelJar] = useState<string | null>(jarId ?? null);
  const [note, setNote] = useState(op?.note ?? '');
  const [errors, setErrors] = useState<{ amount?: string; jar?: string; note?: string }>({});
  const categories = useCategories();
  const debt = sum(useDeviations(), deviationLeft);
  // Куда идут снятые деньги: OUT — просто снять, DEBT — погасить перерасход, иначе id статьи.
  const [dest, setDest] = useState<string>(OUT);
  const isNewWithdraw = type === 'withdraw' && !op;
  // Операции, связанные со статьёй или перерасходом, нельзя менять по сумме — только удалить и создать заново.
  const locked = !!op?.link;

  const balance = selJar ? jarBalance(selJar, ops) + (op && op.type === 'withdraw' ? op.amount : 0) : 0;

  async function submit() {
    const a = parseAmount(amount);
    const e: typeof errors = {};
    if (Number.isNaN(a) || a <= 0) e.amount = 'Введите сумму больше нуля';
    else if (type === 'withdraw' && a > balance) e.amount = `В копилке только ${money(balance)}`;
    if (!selJar) e.jar = 'Выберите копилку';
    if (isNewWithdraw && dest === DEBT && !Number.isNaN(a) && a > debt) e.amount = `Перерасхода всего ${money(debt)}`;
    if (type === 'withdraw' && dest === OUT && !locked && !op?.source && !note.trim())
      e.note = 'Напишите, на что снимаете — так проще потом вспомнить';
    setErrors(e);
    if (Object.keys(e).length || !selJar) return;

    if (isNewWithdraw && dest !== OUT) {
      if (dest === DEBT) {
        await repayDeviations(a, { source: 'jar', jarId: selJar, date });
        toast(a >= debt ? 'Перерасход погашен 🎉' : `Погашено ${money(a)}`);
      } else {
        await topUpCategoryFromJar({ jarId: selJar, categoryId: dest, amount: a, date, note: note.trim() });
        const c = categories.find((x) => x.id === dest);
        toast(`Лимит «${c?.name}» увеличен на ${money(a)}`);
      }
      onDone();
      return;
    }

    const jar = await db.jars.get(selJar);
    const allOps = await db.jarOperations.where('jarId').equals(selJar).toArray();
    const before = jarBalance(selJar, allOps);

    if (op) {
      await updateJarOperation(op.id, locked ? { date, note: note.trim() } : { amount: a, date, jarId: selJar, note: note.trim() });
      toast('Операция сохранена');
    } else {
      await addJarOperation({ jarId: selJar, type, amount: a, date, note: note.trim() });
      toast(type === 'deposit' ? `Внесено ${money(a)}` : `Снято ${money(a)}`);
    }

    const after = jarBalance(selJar, await db.jarOperations.where('jarId').equals(selJar).toArray());
    if (jar && jar.goalAmount > 0 && before < jar.goalAmount && after >= jar.goalAmount) {
      launchConfetti();
      toast(`Цель «${jar.name}» достигнута! 🎉`);
    }
    onDone();
  }

  return (
    <div>
      <Field label="Сумма" error={errors.amount}>
        {locked ? (
          <div className="flex h-16 items-center rounded-2xl bg-card-2 px-4 text-3xl font-semibold">{money(op!.amount)}</div>
        ) : (
          <MoneyInput value={amount} onChange={setAmount} autoFocus={!op} large />
        )}
      </Field>
      {locked && (
        <p className="-mt-2 mb-4 text-xs text-muted">
          {op!.source}. Сумму и копилку такой операции изменить нельзя — удалите её и создайте заново.
        </p>
      )}
      <div className="mb-4" hidden={locked}>
        <span className="mb-1.5 block text-sm font-medium text-muted">{type === 'withdraw' ? 'Из какой копилки' : 'Копилка'}</span>
        <Chips accent="save" items={jars.map((j) => ({ id: j.id, label: j.name, icon: j.icon }))} value={selJar} onChange={setSelJar} />
        {errors.jar && <span className="mt-1 block text-sm text-over">{errors.jar}</span>}
        {type === 'withdraw' && selJar && <span className="mt-1 block text-sm text-muted">Доступно: {money(balance)}</span>}
      </div>
      {isNewWithdraw && (
        <div className="mb-4">
          <span className="mb-1.5 block text-sm font-medium text-muted">Куда</span>
          <Chips
            accent="save"
            items={[
              { id: OUT, label: 'Просто снять', icon: '💸' },
              ...(debt > 0 ? [{ id: DEBT, label: `Перерасход · ${money(debt)}`, icon: '⚠️' }] : []),
              ...categories.map((c) => ({ id: c.id, label: c.name, icon: c.icon })),
            ]}
            value={dest}
            onChange={setDest}
          />
          <p className="mt-2 text-xs text-muted">
            {dest === OUT
              ? 'Деньги просто уйдут из копилки.'
              : dest === DEBT
                ? 'Сумма погасит перерасход — сначала самый старый.'
                : 'Лимит статьи в текущем периоде увеличится на эту сумму.'}
          </p>
        </div>
      )}
      <Field label="Дата">
        <DateInput value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field
        label={type === 'withdraw' && dest === OUT && !op?.source ? 'Комментарий' : 'Комментарий (необязательно)'}
        error={errors.note}
      >
        <TextInput value={note} onChange={(e) => setNote(e.target.value)} maxLength={80} placeholder={type === 'withdraw' ? 'На что снимаете' : ''} />
      </Field>
      <Button variant="save" block onClick={submit}>
        Готово
      </Button>
    </div>
  );
}
