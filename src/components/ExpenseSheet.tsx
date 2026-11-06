import { useState } from 'react';
import type { Expense } from '../db/types';
import { addExpense, updateExpense } from '../db/actions';
import { useCategories } from '../hooks/useData';
import { today } from '../lib/dates';
import { amountToInput, money, parseAmount } from '../lib/format';
import { Sheet } from './ui/Sheet';
import { Button, Chips, DateInput, Field, MoneyInput, TextInput } from './ui/controls';
import { useFeedback } from './ui/feedback';

/**
 * Окно добавления / редактирования траты.
 * Порядок полей — для быстрого ввода: сумма → статья → название → «Добавить».
 */
export function ExpenseSheet({
  open,
  onClose,
  categoryId,
  expense,
}: {
  open: boolean;
  onClose: () => void;
  categoryId?: string;
  expense?: Expense | null;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={expense ? 'Изменить операцию' : 'Новая трата'}>
      {open && <ExpenseForm key={expense?.id ?? 'new'} onDone={onClose} categoryId={categoryId} expense={expense} />}
    </Sheet>
  );
}

function ExpenseForm({ onDone, categoryId, expense }: { onDone: () => void; categoryId?: string; expense?: Expense | null }) {
  const categories = useCategories();
  const { toast } = useFeedback();
  const [amount, setAmount] = useState(expense ? amountToInput(expense.amount) : '');
  const [catId, setCatId] = useState<string | null>(expense?.categoryId ?? categoryId ?? null);
  const [title, setTitle] = useState(expense?.title ?? '');
  const [date, setDate] = useState(expense?.date ?? today());
  const [errors, setErrors] = useState<{ amount?: string; cat?: string; date?: string }>({});

  async function submit() {
    const a = parseAmount(amount);
    const e: typeof errors = {};
    if (Number.isNaN(a) || a <= 0) e.amount = 'Введите сумму больше нуля';
    if (!catId) e.cat = 'Выберите статью';
    if (!date) e.date = 'Укажите дату';
    setErrors(e);
    if (Object.keys(e).length || !catId) return;
    const cat = categories.find((c) => c.id === catId);
    const data = { categoryId: catId, amount: a, title: title.trim() || cat?.name || 'Трата', date };
    if (expense) {
      await updateExpense(expense.id, data);
      toast('Операция сохранена');
    } else {
      await addExpense(data);
      toast(`Добавлено: ${money(a)}`);
    }
    onDone();
  }

  return (
    <div>
      <Field label="Сумма" error={errors.amount}>
        <MoneyInput value={amount} onChange={setAmount} autoFocus={!expense} large />
      </Field>
      <div className="mb-4">
        <span className="mb-1.5 block text-sm font-medium text-muted">Статья</span>
        <Chips
          items={categories.map((c) => ({ id: c.id, label: c.name, icon: c.icon }))}
          value={catId}
          onChange={setCatId}
        />
        {errors.cat && <span className="mt-1 block text-sm text-over">{errors.cat}</span>}
      </div>
      <Field label="Название (необязательно)">
        <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например, Пятёрочка" maxLength={60} />
      </Field>
      <Field label="Дата" error={errors.date}>
        <DateInput value={date} max="2100-12-31" onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Button variant="spend" block onClick={submit}>
        {expense ? 'Сохранить' : 'Добавить'}
      </Button>
    </div>
  );
}
