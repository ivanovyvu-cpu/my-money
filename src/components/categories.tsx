import { useState } from 'react';
import type { Category, Period } from '../db/types';
import { PERIOD_LABELS } from '../db/types';
import type { CategoryStats } from '../lib/calc';
import { amountToInput, money, parseAmount } from '../lib/format';
import { formatDate, formatRange } from '../lib/dates';
import { Button, Field, MoneyInput, ProgressBar, Segmented, TextInput } from './ui/controls';
import { EmojiPicker } from './ui/EmojiPicker';

export const PERIOD_OPTIONS: Array<{ value: Period; label: string }> = [
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'quarter', label: 'Квартал' },
  { value: 'year', label: 'Год' },
];

/** Плашка статьи расходов в списке. */
export function CategoryTile({ cat, st, onClick }: { cat: Category; st: CategoryStats; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="animate-pop-in block w-full rounded-[16px] bg-card p-4 text-left shadow-soft transition-transform duration-150 active:scale-[0.99]"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-spend-soft text-2xl">{cat.icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate font-semibold">{cat.name}</span>
            <span className={`shrink-0 text-lg font-bold ${st.remaining < 0 ? 'text-over' : ''}`}>{money(st.remaining)}</span>
          </div>
          <div className="flex justify-between text-sm text-muted">
            <span>
              {money(st.spent)} из {money(st.effectiveLimit)}
            </span>
            <span>{st.remaining < 0 ? 'перерасход' : 'остаток'}</span>
          </div>
        </div>
      </div>
      <div className="mt-3">
        <ProgressBar ratio={st.ratio} status={st.status} />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-muted">
        <span>
          {PERIOD_LABELS[cat.period]} · {formatRange(st.range)}
        </span>
        {cat.carryOver > 0 && <span>перенос −{money(cat.carryOver)}</span>}
        {cat.carryOver < 0 && <span>из копилки +{money(-cat.carryOver)}</span>}
      </div>
      {st.plannedSum > 0 && (
        <div className="mt-1 text-xs text-muted">
          📌 в планах {money(st.plannedSum)} · после них{' '}
          <span className={st.afterPlans < 0 ? 'font-semibold text-over' : ''}>{money(st.afterPlans)}</span>
        </div>
      )}
      {st.notStarted && (
        <div className="mt-3 rounded-xl bg-card-2 px-3 py-2 text-sm text-muted">✓ Период закрыт · новый с {formatDate(st.range.start)}</div>
      )}
      {st.expired && (
        <div className="mt-3 rounded-xl bg-warn/15 px-3 py-2 text-sm font-medium">⏰ Период завершён — закрыть?</div>
      )}
    </button>
  );
}

export interface CategoryFormValue {
  name: string;
  icon: string;
  limit: number;
  period: Period;
}

/** Форма создания / редактирования статьи. */
export function CategoryForm({
  initial,
  submitText,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<CategoryFormValue>;
  submitText: string;
  onSubmit: (v: CategoryFormValue) => Promise<void> | void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [limit, setLimit] = useState(amountToInput(initial?.limit ?? 0));
  const [period, setPeriod] = useState<Period>(initial?.period ?? 'month');
  const [icon, setIcon] = useState(initial?.icon ?? '🛒');
  const [errors, setErrors] = useState<{ name?: string; limit?: string }>({});

  async function submit() {
    const e: typeof errors = {};
    if (!name.trim()) e.name = 'Введите название';
    const l = limit.trim() === '' ? 0 : parseAmount(limit);
    if (Number.isNaN(l) || l < 0) e.limit = 'Введите сумму числом, например 15 000';
    setErrors(e);
    if (Object.keys(e).length) return;
    await onSubmit({ name: name.trim(), icon, limit: l, period });
  }

  return (
    <div>
      <Field label="Название" error={errors.name}>
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Например, Кафе" maxLength={40} />
      </Field>
      <Field label="Лимит на период" error={errors.limit}>
        <MoneyInput value={limit} onChange={setLimit} />
      </Field>
      <div className="mb-4">
        <span className="mb-1.5 block text-sm font-medium text-muted">Периодичность</span>
        <Segmented options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
      </div>
      <div className="mb-5">
        <span className="mb-1.5 block text-sm font-medium text-muted">Иконка</span>
        <EmojiPicker value={icon} onChange={setIcon} kind="spend" />
      </div>
      <div className="flex gap-2">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} className="flex-1">
            Отмена
          </Button>
        )}
        <Button variant="spend" onClick={submit} className="flex-[2]">
          {submitText}
        </Button>
      </div>
    </div>
  );
}

/** Последняя плашка списка: раскрывается в форму создания. */
export function AddTile({
  label,
  accent,
  open,
  onToggle,
  children,
}: {
  label: string;
  accent: 'spend' | 'save';
  open: boolean;
  onToggle: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-[16px] border-2 border-dashed transition-colors duration-200 ${
        open ? 'border-transparent bg-card shadow-soft' : accent === 'spend' ? 'border-spend/40' : 'border-save/40'
      }`}
    >
      <button
        type="button"
        onClick={() => onToggle(!open)}
        className={`flex min-h-16 w-full items-center justify-center gap-2 font-semibold ${
          accent === 'spend' ? 'text-spend' : 'text-save'
        }`}
      >
        <span className={`text-2xl transition-transform duration-200 ${open ? 'rotate-45' : ''}`}>+</span>
        {label}
      </button>
      <div className={`expand ${open ? 'open' : ''}`}>
        <div>
          <div className="px-4 pb-4" inert={!open}>{children}</div>
        </div>
      </div>
    </div>
  );
}
