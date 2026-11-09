import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { addExpense, deleteExpense } from '../db/actions';
import { useAllExpenses, useCategories, useQuickTemplates } from '../hooks/useData';
import { navigate } from '../hooks/useRoute';
import { categoryColor, categoryTint } from '../lib/colors';
import { today } from '../lib/dates';
import { money } from '../lib/format';
import { quickKey, suggestTemplates, usageCounts } from '../lib/suggest';
import { TemplateForm } from './QuickTemplates';
import { Sheet } from './ui/Sheet';
import { useFeedback } from './ui/feedback';

export interface QuickItem {
  key: string;
  title: string;
  categoryId: string;
  amount?: number;
  /** Предложение по истории, ещё не закреплённое пользователем. */
  suggested: boolean;
  uses: number;
}

const MIN_FONT = 15;
const MAX_FONT = 34;

/**
 * Полноэкранное «облако» быстрых трат. Цвет кнопки — цвет статьи,
 * размер — сколько раз за 3 месяца была такая трата (чем чаще, тем крупнее).
 */
export function QuickCloud({
  open,
  onClose,
  onNeedAmount,
}: {
  open: boolean;
  onClose: () => void;
  /** Кнопка без суммы: открыть форму, где останется ввести сумму. */
  onNeedAmount: (t: { title: string; categoryId: string }) => void;
}) {
  const templates = useQuickTemplates();
  const expenses = useAllExpenses();
  const categories = useCategories();
  const allCats = useCategories(true);
  const { toast } = useFeedback();
  const [flash, setFlash] = useState<{ key: string; n: number } | null>(null);
  const [adding, setAdding] = useState(false);
  // Порядок кнопок запоминаем при открытии: после нажатия кнопка растёт, но не прыгает под пальцем.
  const order = useRef<string[] | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !adding && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, adding, onClose]);

  if (!open) {
    order.current = null;
    return null;
  }

  const alive = (t: { categoryId: string }) => categories.some((c) => c.id === t.categoryId);
  const counts = usageCounts(expenses);
  const items: QuickItem[] = [
    ...templates.filter(alive).map((t) => ({
      key: t.id,
      title: t.title,
      categoryId: t.categoryId,
      amount: t.amount,
      suggested: false,
      uses: counts.get(quickKey(t)) ?? 0,
    })),
    ...suggestTemplates(expenses, templates, 12)
      .filter(alive)
      .map((s) => ({ key: `s-${quickKey(s)}`, ...s, suggested: true, uses: counts.get(quickKey(s)) ?? s.count })),
  ];
  if (!order.current || items.some((i) => !order.current!.includes(i.key))) {
    order.current = [...(order.current ?? []), ...arrangeCloud(items).map((i) => i.key).filter((k) => !order.current?.includes(k))];
  }
  const pos = (k: string) => order.current!.indexOf(k);
  const cloud = [...items].sort((a, b) => pos(a.key) - pos(b.key));
  const fontOf = fontScale(items.map((i) => i.uses));

  async function pick(t: QuickItem) {
    if (!t.amount) {
      onNeedAmount({ title: t.title, categoryId: t.categoryId });
      return;
    }
    const id = await addExpense({ categoryId: t.categoryId, title: t.title, amount: t.amount, date: today() });
    setFlash((f) => ({ key: t.key, n: (f?.n ?? 0) + 1 }));
    toast(`${t.title}: ${money(t.amount)} — добавлено`, { label: 'Отменить', onClick: () => deleteExpense(id) });
  }

  return createPortal(
    <div className="animate-fade-in fixed inset-0 z-[45] flex flex-col bg-bg" role="dialog" aria-modal="true" aria-label="Быстрые траты">
      <header className="mx-auto flex w-full max-w-[480px] items-center gap-2 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+12px)]">
        <h2 className="flex-1 text-2xl font-bold">⚡ Быстрые траты</h2>
        <button
          type="button"
          aria-label="Закрыть"
          onClick={onClose}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-card text-xl shadow-soft"
        >
          ✕
        </button>
      </header>
      <p className="mx-auto w-full max-w-[480px] px-4 text-sm text-muted">
        Чем чаще трата — тем крупнее кнопка. С суммой — добавляется сразу, «₽?» — спросит сумму.
      </p>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {items.length === 0 ? (
          <div className="mx-auto max-w-[480px] px-6 py-16 text-center text-muted">
            <div className="mb-3 text-5xl">⚡</div>
            Здесь появятся кнопки для частых трат. Добавьте свою — или просто вносите траты: то, что повторяется, появится
            здесь само.
          </div>
        ) : (
          <div className="mx-auto flex min-h-full max-w-[480px] flex-wrap content-center items-center justify-center gap-2.5 px-4 py-6">
            {cloud.map((t, i) => {
              const color = categoryColor(t.categoryId, allCats);
              const bumped = flash?.key === t.key;
              return (
                <button
                  key={bumped ? `${t.key}-${flash.n}` : t.key}
                  type="button"
                  onClick={() => pick(t)}
                  className={`animate-pop-in relative inline-flex max-w-full items-baseline gap-[0.35em] rounded-[0.8em] border-2 font-semibold leading-tight text-text transition-[transform,font-size] duration-300 active:scale-90 ${
                    t.suggested ? 'border-dashed' : ''
                  }`}
                  style={{
                    fontSize: fontOf(t.uses),
                    padding: '0.4em 0.7em',
                    borderColor: color,
                    background: categoryTint(t.categoryId, allCats, t.suggested ? 8 : 24),
                    animationDelay: bumped ? '0ms' : `${Math.min(i, 20) * 25}ms`,
                  }}
                >
                  <span className="truncate">{t.title}</span>
                  <span className="shrink-0 text-[0.6em] font-medium text-muted">{t.amount ? money(t.amount) : '₽?'}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <footer className="pb-safe mx-auto w-full max-w-[480px] px-4">
        {categories.length > 0 && items.length > 0 && (
          <div className="mb-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-muted">
            {categories
              .filter((c) => items.some((i) => i.categoryId === c.id))
              .map((c) => (
                <span key={c.id} className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: categoryColor(c.id, allCats) }} />
                  {c.name}
                </span>
              ))}
          </div>
        )}
        <div className="mb-3 flex gap-2">
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="min-h-12 flex-1 rounded-2xl bg-card font-semibold shadow-soft active:scale-[0.98]"
          >
            + Своя кнопка
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              navigate('/settings');
            }}
            className="min-h-12 flex-1 rounded-2xl bg-card font-semibold shadow-soft active:scale-[0.98]"
          >
            ⚙️ Настроить
          </button>
        </div>
      </footer>

      <Sheet open={adding} onClose={() => setAdding(false)} title="Новая быстрая кнопка">
        {adding && <TemplateForm template={null} onDone={() => setAdding(false)} />}
      </Sheet>
    </div>,
    document.body,
  );
}

/** Логарифмическая шкала: разница между 1 и 5 тратами заметнее, чем между 40 и 45. */
function fontScale(uses: number[]) {
  const logs = uses.map((u) => Math.log(u + 1));
  const lo = Math.min(...logs);
  const hi = Math.max(...logs);
  return (u: number) => {
    const t = hi > lo ? (Math.log(u + 1) - lo) / (hi - lo) : 0.4;
    return `${Math.round(MIN_FONT + t * (MAX_FONT - MIN_FONT))}px`;
  };
}

/** Самые частые — в середине облака, редкие — по краям. */
function arrangeCloud(items: QuickItem[]): QuickItem[] {
  const sorted = [...items].sort((a, b) => b.uses - a.uses || a.title.localeCompare(b.title, 'ru'));
  const out: QuickItem[] = [];
  sorted.forEach((t, i) => (i % 2 ? out.unshift(t) : out.push(t)));
  return out;
}
