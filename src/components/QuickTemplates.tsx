import { useState } from 'react';
import type { QuickTemplate } from '../db/types';
import { addQuickTemplate, deleteQuickTemplate, updateQuickTemplate } from '../db/actions';
import { useAllExpenses, useCategories, useQuickTemplates } from '../hooks/useData';
import { amountToInput, money, parseAmount } from '../lib/format';
import { suggestTemplates } from '../lib/suggest';
import { Sheet } from './ui/Sheet';
import { Button, Chips, Field, MoneyInput, TextInput } from './ui/controls';
import { useFeedback } from './ui/feedback';

/** Раздел настроек «Быстрые траты»: свои кнопки и предложения по истории. */
export function QuickTemplatesSection() {
  const templates = useQuickTemplates();
  const expenses = useAllExpenses();
  const categories = useCategories();
  const { confirm, toast } = useFeedback();
  const [edit, setEdit] = useState<QuickTemplate | 'new' | null>(null);
  const suggestions = suggestTemplates(expenses, templates, 6);
  const cat = (id: string) => categories.find((c) => c.id === id);

  return (
    <>
      <p className="mb-3 text-sm text-muted">
        Кнопки появляются вверху окна «+». С суммой — трата добавляется одним касанием. Без суммы — заполнено всё, кроме
        суммы.
      </p>
      {templates.length > 0 && (
        <ul className="mb-3 flex flex-col gap-2">
          {templates.map((t) => (
            <li key={t.id} className="flex items-center gap-2 rounded-2xl bg-card-2 p-2 pl-3">
              <button type="button" className="min-h-11 min-w-0 flex-1 text-left" onClick={() => setEdit(t)}>
                <div className="truncate font-medium">
                  {cat(t.categoryId)?.icon ?? '❔'} {t.title}
                </div>
                <div className="truncate text-xs text-muted">
                  {cat(t.categoryId)?.name ?? 'статья удалена'} · {t.amount ? money(t.amount) : 'сумма каждый раз'}
                </div>
              </button>
              <button
                type="button"
                aria-label="Удалить кнопку"
                className="flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-card"
                onClick={async () => {
                  if (await confirm({ title: 'Удалить быструю кнопку?', message: t.title, confirmText: 'Удалить', danger: true })) {
                    await deleteQuickTemplate(t.id);
                  }
                }}
              >
                🗑
              </button>
            </li>
          ))}
        </ul>
      )}
      <Button variant="soft" block onClick={() => setEdit('new')}>
        + Добавить кнопку
      </Button>

      {suggestions.length > 0 && (
        <>
          <div className="mb-2 mt-4 text-sm font-medium text-muted">Предложения по вашим частым тратам</div>
          <ul className="flex flex-col gap-2">
            {suggestions.map((s) => (
              <li key={`${s.categoryId}-${s.title}`} className="flex items-center gap-2 rounded-2xl border border-dashed border-line p-2 pl-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">
                    {cat(s.categoryId)?.icon} {s.title}
                  </div>
                  <div className="truncate text-xs text-muted">
                    {s.count} раз за 4 месяца · {s.amount ? money(s.amount) : 'разные суммы'}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  className="min-h-11 px-3 text-sm"
                  onClick={async () => {
                    await addQuickTemplate({ title: s.title, categoryId: s.categoryId, amount: s.amount });
                    toast('Кнопка добавлена');
                  }}
                >
                  📌 Закрепить
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}

      <Sheet open={edit !== null} onClose={() => setEdit(null)} title={edit === 'new' ? 'Новая быстрая кнопка' : 'Изменить кнопку'}>
        {edit !== null && <TemplateForm key={edit === 'new' ? 'new' : edit.id} template={edit === 'new' ? null : edit} onDone={() => setEdit(null)} />}
      </Sheet>
    </>
  );
}

function TemplateForm({ template, onDone }: { template: QuickTemplate | null; onDone: () => void }) {
  const categories = useCategories();
  const [title, setTitle] = useState(template?.title ?? '');
  const [catId, setCatId] = useState<string | null>(template?.categoryId ?? null);
  const [amount, setAmount] = useState(template?.amount ? amountToInput(template.amount) : '');
  const [errors, setErrors] = useState<{ title?: string; cat?: string; amount?: string }>({});

  async function submit() {
    const e: typeof errors = {};
    if (!title.trim()) e.title = 'Введите название, например «Кофе»';
    if (!catId) e.cat = 'Выберите статью';
    const a = amount.trim() === '' ? undefined : parseAmount(amount);
    if (a !== undefined && (Number.isNaN(a) || a <= 0)) e.amount = 'Сумма должна быть больше нуля — или оставьте поле пустым';
    setErrors(e);
    if (Object.keys(e).length || !catId) return;
    const data = { title: title.trim(), categoryId: catId, amount: a };
    if (template) await updateQuickTemplate(template.id, data);
    else await addQuickTemplate(data);
    onDone();
  }

  return (
    <div>
      <Field label="Название" error={errors.title}>
        <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например, Кофе" maxLength={40} />
      </Field>
      <div className="mb-4">
        <span className="mb-1.5 block text-sm font-medium text-muted">Статья</span>
        <Chips items={categories.map((c) => ({ id: c.id, label: c.name, icon: c.icon }))} value={catId} onChange={setCatId} />
        {errors.cat && <span className="mt-1 block text-sm text-over">{errors.cat}</span>}
      </div>
      <Field label="Сумма (необязательно)" error={errors.amount}>
        <MoneyInput value={amount} onChange={setAmount} placeholder="вводить каждый раз" />
      </Field>
      <p className="-mt-2 mb-5 text-xs text-muted">
        Если оставить пустым, при нажатии на кнопку откроется форма, где останется ввести только сумму.
      </p>
      <Button variant="spend" block onClick={submit}>
        {template ? 'Сохранить' : 'Добавить кнопку'}
      </Button>
    </div>
  );
}
