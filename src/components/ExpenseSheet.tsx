import { useState } from 'react';
import type { Expense } from '../db/types';
import { addExpense, updateExpense } from '../db/actions';
import { useCategories } from '../hooks/useData';
import { formatDate, today } from '../lib/dates';
import { amountToInput, money, parseAmount } from '../lib/format';
import { Sheet } from './ui/Sheet';
import { Button, Chips, DateInput, Field, MoneyInput, Segmented, TextInput } from './ui/controls';
import { useFeedback } from './ui/feedback';

type Mode = 'actual' | 'planned';

/**
 * Окно добавления / редактирования траты.
 * Поля для быстрого ввода: сумма → статья → название → «Добавить».
 * `preset` — заполнить статью и название заранее (быстрая кнопка без суммы).
 */
export function ExpenseSheet({
  open,
  onClose,
  categoryId,
  expense,
  mode,
  preset,
}: {
  open: boolean;
  onClose: () => void;
  categoryId?: string;
  expense?: Expense | null;
  /** С чего начинать новую операцию: фактическая трата или запланированная. */
  mode?: Mode;
  preset?: { title: string; categoryId: string } | null;
}) {
  const title = expense ? (expense.planned ? 'Изменить план' : 'Изменить операцию') : mode === 'planned' ? 'Запланировать трату' : 'Новая трата';
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {open && (
        <ExpenseForm
          key={expense?.id ?? `new-${mode}-${preset?.title ?? ''}`}
          onDone={onClose}
          categoryId={preset?.categoryId ?? categoryId}
          presetTitle={preset?.title}
          expense={expense}
          initialMode={mode}
        />
      )}
    </Sheet>
  );
}

const AMOUNT_ID = 'expense-amount';

function ExpenseForm({
  onDone,
  categoryId,
  expense,
  initialMode = 'actual',
  presetTitle,
}: {
  onDone: () => void;
  categoryId?: string;
  presetTitle?: string;
  expense?: Expense | null;
  initialMode?: Mode;
}) {
  const categories = useCategories();
  const { toast } = useFeedback();
  const [amount, setAmount] = useState(expense ? amountToInput(expense.amount) : '');
  const [catId, setCatId] = useState<string | null>(expense?.categoryId ?? categoryId ?? null);
  const [title, setTitle] = useState(expense?.title ?? presetTitle ?? '');
  const [date, setDate] = useState(expense?.date ?? today());
  const [mode, setMode] = useState<Mode>(expense ? (expense.planned ? 'planned' : 'actual') : initialMode);
  // Пока пользователь сам не переключал режим, будущая дата автоматически делает трату плановой.
  const [modeTouched, setModeTouched] = useState(!!expense);
  const [errors, setErrors] = useState<{ amount?: string; cat?: string; date?: string }>({});
  const selectedCat = categories.find((c) => c.id === catId);

  function onDateChange(v: string) {
    setDate(v);
    if (!modeTouched) setMode(v > today() ? 'planned' : 'actual');
  }

  async function submit() {
    const a = parseAmount(amount);
    const e: typeof errors = {};
    if (Number.isNaN(a) || a <= 0) e.amount = 'Введите сумму больше нуля';
    if (!catId) e.cat = 'Выберите статью';
    if (!date) e.date = 'Укажите дату';
    setErrors(e);
    if (Object.keys(e).length || !catId) return;
    const cat = categories.find((c) => c.id === catId);
    const data = { categoryId: catId, amount: a, title: title.trim() || cat?.name || 'Трата', date, planned: mode === 'planned' };
    if (expense) {
      await updateExpense(expense.id, data);
      toast('Сохранено');
    } else {
      await addExpense(data);
      toast(mode === 'planned' ? `Запланировано: ${money(a)} на ${formatDate(date)}` : `Добавлено: ${money(a)}`);
    }
    onDone();
  }


  return (
    <div>
      <div className="mb-4">
        <Segmented
          options={[
            { value: 'actual', label: '💸 Потрачено' },
            { value: 'planned', label: '📌 Запланировано' },
          ]}
          value={mode}
          onChange={(m) => {
            setMode(m);
            setModeTouched(true);
          }}
        />
      </div>
      <Field label="Сумма" error={errors.amount}>
        <MoneyInput id={AMOUNT_ID} value={amount} onChange={setAmount} autoFocus={!expense} large />
      </Field>
      <div className="mb-4">
        <span className="mb-1.5 block text-sm font-medium text-muted">Статья</span>
        <Chips items={categories.map((c) => ({ id: c.id, label: c.name, icon: c.icon }))} value={catId} onChange={setCatId} />
        {errors.cat && <span className="mt-1 block text-sm text-over">{errors.cat}</span>}
      </div>
      <Field label="Название (необязательно)">
        <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например, Пятёрочка" maxLength={60} />
      </Field>
      <Field label={mode === 'planned' ? 'Когда планируется' : 'Дата'} error={errors.date}>
        <DateInput value={date} max="2100-12-31" onChange={(e) => onDateChange(e.target.value)} />
      </Field>
      {mode === 'planned' && (
        <p className="-mt-2 mb-4 rounded-xl bg-card-2 px-3 py-2 text-sm text-muted">
          План не уменьшает остаток, пока вы не отметите его оплаченным. В статье будет видно, сколько останется после всех
          планов.
        </p>
      )}
      {mode === 'actual' && selectedCat && date && date < selectedCat.currentPeriodStart && (
        <p className="-mt-2 mb-4 rounded-xl bg-warn/15 px-3 py-2 text-sm">
          Эта дата относится к уже закрытому периоду статьи — трата сохранится в истории, но не изменит текущий остаток.
        </p>
      )}
      <Button variant="spend" block onClick={submit}>
        {expense ? 'Сохранить' : mode === 'planned' ? 'Запланировать' : 'Добавить'}
      </Button>
    </div>
  );
}
