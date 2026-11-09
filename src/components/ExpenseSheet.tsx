import { useState } from 'react';
import type { Expense, QuickTemplate } from '../db/types';
import { addExpense, deleteExpense, updateExpense } from '../db/actions';
import { useAllExpenses, useCategories, useQuickTemplates } from '../hooks/useData';
import { navigate } from '../hooks/useRoute';
import { formatDate, today } from '../lib/dates';
import { amountToInput, money, parseAmount } from '../lib/format';
import { suggestTemplates } from '../lib/suggest';
import { Sheet } from './ui/Sheet';
import { Button, Chips, DateInput, Field, MoneyInput, Segmented, TextInput } from './ui/controls';
import { useFeedback } from './ui/feedback';

type Mode = 'actual' | 'planned';

/**
 * Окно добавления / редактирования траты.
 * Сверху — быстрые кнопки, дальше поля для быстрого ввода: сумма → статья → название → «Добавить».
 */
export function ExpenseSheet({
  open,
  onClose,
  categoryId,
  expense,
  mode,
}: {
  open: boolean;
  onClose: () => void;
  categoryId?: string;
  expense?: Expense | null;
  /** С чего начинать новую операцию: фактическая трата или запланированная. */
  mode?: Mode;
}) {
  const title = expense ? (expense.planned ? 'Изменить план' : 'Изменить операцию') : mode === 'planned' ? 'Запланировать трату' : 'Новая трата';
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {open && (
        <ExpenseForm key={expense?.id ?? `new-${mode}`} onDone={onClose} categoryId={categoryId} expense={expense} initialMode={mode} />
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
}: {
  onDone: () => void;
  categoryId?: string;
  expense?: Expense | null;
  initialMode?: Mode;
}) {
  const categories = useCategories();
  const { toast } = useFeedback();
  const [amount, setAmount] = useState(expense ? amountToInput(expense.amount) : '');
  const [catId, setCatId] = useState<string | null>(expense?.categoryId ?? categoryId ?? null);
  const [title, setTitle] = useState(expense?.title ?? '');
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

  /** Нажатие на быструю кнопку: с суммой — сразу добавляем, без суммы — заполняем всё, кроме суммы. */
  async function useQuick(t: { title: string; categoryId: string; amount?: number }) {
    if (t.amount) {
      const id = await addExpense({ categoryId: t.categoryId, title: t.title, amount: t.amount, date: today() });
      toast(`${t.title}: ${money(t.amount)}`, { label: 'Отменить', onClick: () => deleteExpense(id) });
      onDone();
      return;
    }
    setCatId(t.categoryId);
    setTitle(t.title);
    setDate(today());
    setMode('actual');
    document.getElementById(AMOUNT_ID)?.focus();
  }

  return (
    <div>
      {!expense && mode === 'actual' && (
        <QuickRow
          preferCategory={categoryId}
          onPick={useQuick}
          onSettings={() => {
            onDone();
            navigate('/settings');
          }}
        />
      )}
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

/** Ряд быстрых кнопок: сохранённые пользователем + предложения по частым тратам. */
function QuickRow({
  preferCategory,
  onPick,
  onSettings,
}: {
  preferCategory?: string;
  onPick: (t: { title: string; categoryId: string; amount?: number }) => void;
  onSettings: () => void;
}) {
  const templates = useQuickTemplates();
  const expenses = useAllExpenses();
  const categories = useCategories();
  const icon = (id: string) => categories.find((c) => c.id === id)?.icon ?? '•';
  const alive = (t: { categoryId: string }) => categories.some((c) => c.id === t.categoryId);

  const own = templates
    .filter(alive)
    .sort((a, b) => Number(b.categoryId === preferCategory) - Number(a.categoryId === preferCategory));
  const suggestions = suggestTemplates(expenses, templates).filter(alive);
  if (own.length === 0 && suggestions.length === 0) return null;

  const chip = (t: Pick<QuickTemplate, 'title' | 'categoryId' | 'amount'>, key: string, suggested: boolean) => (
    <button
      key={key}
      type="button"
      onClick={() => onPick(t)}
      className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-2xl border px-3 text-sm font-medium transition-transform duration-150 active:scale-95 ${
        suggested ? 'border-dashed border-line bg-card' : 'border-spend/40 bg-spend-soft'
      }`}
    >
      <span>{icon(t.categoryId)}</span>
      <span className="max-w-[9rem] truncate">{t.title}</span>
      <span className="text-muted">{t.amount ? `· ${money(t.amount)}` : '· ₽?'}</span>
    </button>
  );

  return (
    <div className="mb-4">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm font-medium text-muted">Быстрые траты</span>
        <button type="button" className="min-h-8 text-sm text-muted underline" onClick={onSettings}>
          настроить
        </button>
      </div>
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {own.map((t) => chip(t, t.id, false))}
        {suggestions.map((s) => chip(s, `s-${s.categoryId}-${s.title}`, true))}
      </div>
      {suggestions.length > 0 && (
        <p className="mt-1 text-xs text-muted">Пунктиром — предложения по вашим частым тратам. Закрепить можно в настройках.</p>
      )}
    </div>
  );
}
