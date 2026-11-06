import { useState } from 'react';
import type { Income as IncomeT } from '../db/types';
import { addIncome, deleteIncome, updateIncome } from '../db/actions';
import { useIncomes, useSettings } from '../hooks/useData';
import { inRange } from '../lib/calc';
import { addDays, formatDate, monthName, monthRange, today } from '../lib/dates';
import { amountToInput, money, parseAmount, sum } from '../lib/format';
import { Page, ScreenHeader } from '../components/layout';
import { Button, DateInput, EmptyState, Field, MoneyInput, TextInput } from '../components/ui/controls';
import { Sheet } from '../components/ui/Sheet';
import { useFeedback } from '../components/ui/feedback';

export function Income() {
  const incomes = useIncomes();
  const { monthStartDay } = useSettings();
  const { confirm, toast } = useFeedback();
  const [anchor, setAnchor] = useState(today());
  const [sheet, setSheet] = useState<{ open: boolean; income?: IncomeT | null }>({ open: false });

  const month = monthRange(anchor, monthStartDay);
  const isCurrent = inRange(today(), month);
  const list = incomes.filter((i) => inRange(i.date, month)).sort((a, b) => b.date.localeCompare(a.date));
  const total = sum(list, (i) => i.amount);

  return (
    <>
      <ScreenHeader title="💵 Доходы" />
      <Page>
        <div className="mb-3 flex items-center justify-between rounded-2xl bg-card p-1 shadow-soft">
          <button type="button" aria-label="Предыдущий месяц" className="h-11 w-11 rounded-xl text-xl hover:bg-card-2" onClick={() => setAnchor(addDays(month.start, -1))}>
            ‹
          </button>
          <span className="font-semibold">{monthName(month.start)}</span>
          <button
            type="button"
            aria-label="Следующий месяц"
            disabled={isCurrent}
            className="h-11 w-11 rounded-xl text-xl hover:bg-card-2 disabled:opacity-30"
            onClick={() => setAnchor(addDays(month.end, 1))}
          >
            ›
          </button>
        </div>

        <section className="rounded-[20px] bg-card p-4 shadow-soft">
          <div className="text-sm text-muted">Итого за месяц</div>
          <div className="text-3xl font-bold text-ok">{money(total)}</div>
        </section>

        <Button variant="primary" block className="mt-4" onClick={() => setSheet({ open: true })}>
          + Добавить поступление
        </Button>

        <ul className="mt-4 flex flex-col gap-2">
          {list.length === 0 && <EmptyState>В этом месяце поступлений нет</EmptyState>}
          {list.map((i) => (
            <li key={i.id} className="animate-pop-in flex items-center gap-2 rounded-2xl bg-card p-2 pl-4 shadow-soft">
              <button type="button" className="min-h-11 min-w-0 flex-1 text-left" onClick={() => setSheet({ open: true, income: i })}>
                <div className="truncate font-medium">{i.title}</div>
                <div className="text-xs text-muted">{formatDate(i.date)}</div>
              </button>
              <span className="font-semibold text-ok">+{money(i.amount)}</span>
              <button
                type="button"
                aria-label="Удалить"
                className="flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-card-2"
                onClick={async () => {
                  if (await confirm({ title: 'Удалить поступление?', message: `${i.title} · ${money(i.amount)}`, confirmText: 'Удалить', danger: true })) {
                    await deleteIncome(i.id);
                    toast('Удалено');
                  }
                }}
              >
                🗑
              </button>
            </li>
          ))}
        </ul>
      </Page>

      <Sheet open={sheet.open} onClose={() => setSheet({ open: false })} title={sheet.income ? 'Изменить поступление' : 'Новое поступление'}>
        {sheet.open && <IncomeForm income={sheet.income} onDone={() => setSheet({ open: false })} />}
      </Sheet>
    </>
  );
}

function IncomeForm({ income, onDone }: { income?: IncomeT | null; onDone: () => void }) {
  const { toast } = useFeedback();
  const [title, setTitle] = useState(income?.title ?? '');
  const [amount, setAmount] = useState(income ? amountToInput(income.amount) : '');
  const [date, setDate] = useState(income?.date ?? today());
  const [errors, setErrors] = useState<{ title?: string; amount?: string }>({});

  async function submit() {
    const a = parseAmount(amount);
    const e: typeof errors = {};
    if (!title.trim()) e.title = 'Введите название, например «Зарплата»';
    if (Number.isNaN(a) || a <= 0) e.amount = 'Введите сумму больше нуля';
    setErrors(e);
    if (Object.keys(e).length) return;
    const data = { title: title.trim(), amount: a, date: date || today() };
    if (income) await updateIncome(income.id, data);
    else await addIncome(data);
    toast(income ? 'Сохранено' : `Добавлено ${money(a)}`);
    onDone();
  }

  return (
    <div>
      <Field label="Сумма" error={errors.amount}>
        <MoneyInput value={amount} onChange={setAmount} autoFocus={!income} large />
      </Field>
      <Field label="Название" error={errors.title}>
        <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Зарплата" maxLength={60} />
      </Field>
      <div className="-mt-2 mb-4 flex flex-wrap gap-2">
        {['Зарплата', 'Аванс', 'Подработка', 'Подарок'].map((t) => (
          <button key={t} type="button" onClick={() => setTitle(t)} className="min-h-9 rounded-full bg-card-2 px-3 text-sm">
            {t}
          </button>
        ))}
      </div>
      <Field label="Дата">
        <DateInput value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Button variant="primary" block onClick={submit}>
        {income ? 'Сохранить' : 'Добавить'}
      </Button>
    </div>
  );
}
