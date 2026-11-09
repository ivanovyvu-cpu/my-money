import { useState } from 'react';
import { navigate } from '../hooks/useRoute';
import {
  useCategories,
  useClosedPeriods,
  useDeviations,
  useExpenses,
  usePlannedExpenses,
  useIncomes,
  useJarOperations,
  useJars,
  useSettings,
} from '../hooks/useData';
import { categoryStats, inRange, jarBalance, monthlyLimit } from '../lib/calc';
import { HOME_RANGE_OPTIONS, homeView, toISO } from '../lib/dates';
import { money, plural, sum } from '../lib/format';
import { Page } from '../components/layout';
import { DeviationsSheet } from '../components/DeviationsSheet';
import { deviationLeft, updateSettings } from '../db/actions';
import { Sheet } from '../components/ui/Sheet';
import { PlannedSheet } from '../components/PlannedList';
import { ExpenseSheet } from '../components/ExpenseSheet';
import { QuickCloud } from '../components/QuickCloud';

export function Home() {
  const settings = useSettings();
  const categories = useCategories();
  const expenses = useExpenses();
  const jars = useJars();
  const jarOps = useJarOperations();
  const incomes = useIncomes();
  const closed = useClosedPeriods();
  const deviations = useDeviations();
  const [devOpen, setDevOpen] = useState(false);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [plannedOpen, setPlannedOpen] = useState(false);
  const planned = usePlannedExpenses();
  const [addOpen, setAddOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [preset, setPreset] = useState<{ title: string; categoryId: string } | null>(null);

  // Выбранный период сводки (месяц / 3 / 6 месяцев / год). Дальше «month» — это весь выбранный диапазон.
  const rangeKind = settings.homeRange ?? 'month';
  const view = homeView(rangeKind, settings.monthStartDay);
  const month = view.range;
  const catIds = new Set(categories.map((c) => c.id));
  const monthExpenses = expenses.filter((e) => inRange(e.date, month) && catIds.has(e.categoryId));
  const spentMonth = sum(monthExpenses, (e) => e.amount);
  const limitsMonth = view.months * sum(categories, (c) => monthlyLimit(c.limit, c.period));
  // Остаток по текущим периодам статей — не зависит от выбранного диапазона.
  const leftNow = sum(categories, (c) => categoryStats(c, expenses, settings.monthStartDay).remaining);

  let top: { name: string; icon: string; amount: number } | null = null;
  for (const c of categories) {
    const a = sum(monthExpenses.filter((e) => e.categoryId === c.id), (e) => e.amount);
    if (a > 0 && (!top || a > top.amount)) top = { name: c.name, icon: c.icon, amount: a };
  }

  // «Сэкономлено» — излишки по периодам, закрытым в этом месяце (по дате закрытия).
  const saved = sum(
    closed.filter((p) => p.difference > 0 && inRange(toISO(new Date(p.createdAt)), month)),
    (p) => p.difference,
  );
  const totalSaved = sum(jars, (j) => jarBalance(j.id, jarOps));
  const incomeMonth = sum(incomes.filter((i) => inRange(i.date, month)), (i) => i.amount);
  // Взносы «вручную»: излишки по статьям не считаем — эти деньги уже учтены в лимитах.
  const depositsMonth = sum(
    jarOps.filter((o) => o.type === 'deposit' && !o.source && inRange(o.date, month)),
    (o) => o.amount,
  );
  // Погашения перерасхода из доходов и «текущих денег» тоже расходуют свободные деньги месяца.
  const repaidMonth = sum(
    deviations.flatMap((d) => d.repayments ?? []).filter((r) => r.source !== 'jar' && inRange(r.date, month)),
    (r) => r.amount,
  );
  const free = incomeMonth - limitsMonth - depositsMonth - repaidMonth;
  const devTotal = sum(deviations, deviationLeft);
  // Планы: сколько запланировано в выбранном периоде и сколько уже пора оплатить.
  const todayStr = toISO(new Date());
  const plannedInView = sum(planned.filter((e) => e.date <= month.end), (e) => e.amount);
  const dueCount = planned.filter((e) => e.date <= todayStr).length;
  const expiredCount = categories.filter((c) => categoryStats(c, expenses, settings.monthStartDay).expired).length;

  const incomeCount = incomes.filter((i) => inRange(i.date, month)).length;

  return (
    <Page>
      <header className="pb-3 pt-[calc(env(safe-area-inset-top)+12px)]">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1 truncate text-sm font-medium text-muted">{view.title}</div>
          <button
            type="button"
            onClick={() => setRangeOpen(true)}
            aria-label="Выбрать период сводки"
            className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-card px-3.5 text-sm font-semibold shadow-soft transition-transform duration-150 active:scale-95"
          >
            📅 {HOME_RANGE_OPTIONS.find((o) => o.value === rangeKind)?.label.replace('Текущий месяц', 'Месяц')}
            <span className="text-muted">▾</span>
          </button>
        </div>
        <h1 className="text-2xl font-bold">Финансовый аналитик</h1>
      </header>

      <section className="rounded-[20px] bg-card p-4 shadow-soft">
        <div className="text-sm text-muted">Потрачено {view.short}</div>
        <div className="mt-0.5 flex items-baseline gap-2">
          <span className="text-3xl font-bold">{money(spentMonth)}</span>
          <span className="text-muted">из {money(limitsMonth)}</span>
        </div>
        {limitsMonth > 0 && (
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-card-2">
            <div
              className={`h-full rounded-full ${spentMonth > limitsMonth ? 'bg-over' : spentMonth / limitsMonth >= 0.8 ? 'bg-warn' : 'bg-spend'}`}
              style={{ width: `${Math.min(100, (spentMonth / limitsMonth) * 100)}%` }}
            />
          </div>
        )}
        <div className="mt-2 truncate text-sm text-muted">
          Больше всего:{' '}
          {top ? (
            <span className="text-text">
              {top.icon} {top.name} · {money(top.amount)}
            </span>
          ) : (
            '—'
          )}
        </div>
        {plannedInView > 0 && (
          <button type="button" onClick={() => setPlannedOpen(true)} className="mt-1 block truncate text-left text-sm text-muted">
            📌 Запланировано: <span className="text-text">{money(plannedInView)}</span> ›
          </button>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Stat
            label={`Доходы ${view.short}`}
            value={money(incomeMonth)}
            tone="ok"
            hint={incomeCount ? `${incomeCount} ${plural(incomeCount, ['поступление', 'поступления', 'поступлений'])}` : 'добавить ›'}
            onClick={() => navigate('/income')}
          />
          <Stat label="Свободно" value={money(free)} tone={free < 0 ? 'over' : undefined} hint="доходы − лимиты − взносы − погашения" />
          <Stat label="Сэкономлено" value={money(saved)} hint={rangeKind === 'month' ? 'закрыто в этом месяце' : `закрыто ${view.short}`} tone="ok" />
          <Stat label="Всего в копилках" value={money(totalSaved)} tone="save" />
        </div>
      </section>

      {dueCount > 0 && (
        <button
          type="button"
          onClick={() => setPlannedOpen(true)}
          className="animate-pop-in mt-3 flex min-h-12 w-full items-center justify-between rounded-2xl bg-warn/15 px-4 py-2.5 text-left font-semibold"
        >
          <span>📌 Пора оплатить: {dueCount} {plural(dueCount, ['план', 'плана', 'планов'])}</span>
          <span className="text-xl">›</span>
        </button>
      )}

      {devTotal > 0 && (
        <button
          type="button"
          onClick={() => setDevOpen(true)}
          className="animate-pop-in mt-3 flex min-h-12 w-full items-center justify-between rounded-2xl bg-over-soft px-4 py-2.5 text-left font-semibold text-over"
        >
          <span>⚠️ Перерасход: {money(devTotal)}</span>
          <span className="text-xl">›</span>
        </button>
      )}

      {expiredCount > 0 && (
        <button
          type="button"
          onClick={() => navigate('/spend')}
          className="mt-3 flex min-h-12 w-full items-center justify-between rounded-2xl bg-warn/15 px-4 py-2.5 text-left font-medium"
        >
          <span>⏰ Есть незакрытые периоды: {expiredCount}</span>
          <span className="text-xl">›</span>
        </button>
      )}

      <div className="mt-3 flex flex-col gap-3">
        <BigTile
          onClick={() => navigate('/save')}
          icon="🐷"
          title="Накопить"
          subtitle={`накоплено ${money(totalSaved)}`}
          className="bg-save shadow-[0_8px_24px_rgb(18_165_148/0.3)]"
        />
        <div className="grid grid-cols-2 gap-3">
          <HalfTile
            onClick={() => {
              setPreset(null);
              setAddOpen(true);
            }}
            icon="＋"
            title="Трата"
            subtitle={limitsMonth > 0 ? `осталось ${money(Math.max(0, leftNow))}` : 'внести расход'}
          />
          <HalfTile onClick={() => setQuickOpen(true)} icon="⚡" title="Быстрые" subtitle="частые траты" />
        </div>
      </div>

      <ExpenseSheet
        open={addOpen}
        preset={preset}
        onClose={() => {
          setAddOpen(false);
          setPreset(null);
        }}
      />
      <QuickCloud
        open={quickOpen}
        onClose={() => setQuickOpen(false)}
        onNeedAmount={(t) => {
          setQuickOpen(false);
          setPreset(t);
          setAddOpen(true);
        }}
      />
      <DeviationsSheet open={devOpen} onClose={() => setDevOpen(false)} />
      <PlannedSheet open={plannedOpen} onClose={() => setPlannedOpen(false)} />

      <Sheet open={rangeOpen} onClose={() => setRangeOpen(false)} title="Период сводки">
        <div className="flex flex-col gap-2">
          {HOME_RANGE_OPTIONS.map((o) => {
            const active = o.value === rangeKind;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  updateSettings({ homeRange: o.value });
                  setRangeOpen(false);
                }}
                className={`flex min-h-14 items-center gap-3 rounded-2xl border-2 px-4 text-left transition-colors duration-150 ${
                  active ? 'border-text bg-card-2' : 'border-transparent bg-card-2'
                }`}
              >
                <span className="flex-1">
                  <span className="block font-semibold">{o.label}</span>
                  <span className="block text-sm text-muted">{o.hint}</span>
                </span>
                {active && <span className="text-xl">✓</span>}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted">
          Лимиты за несколько месяцев считаются как месячный лимит × число месяцев. «Всего в копилках» показывает общую
          сумму за всё время.
        </p>
      </Sheet>
    </Page>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
  onClick,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'ok' | 'over' | 'save';
  onClick?: () => void;
}) {
  const color = tone === 'over' ? 'text-over' : tone === 'ok' ? 'text-ok' : tone === 'save' ? 'text-save' : '';
  const body = (
    <>
      <div className="truncate text-xs leading-tight text-muted">{label}</div>
      <div className={`mt-0.5 truncate text-lg font-bold ${color}`}>{value}</div>
      {hint && <div className="truncate text-xs text-muted">{hint}</div>}
    </>
  );
  const cls = 'block w-full rounded-2xl bg-card-2 px-3 py-2 text-left';
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} transition-transform duration-150 active:scale-[0.98]`}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Большая плашка-раздел на главном экране. */
function BigTile({
  onClick,
  icon,
  title,
  subtitle,
  className,
}: {
  onClick: () => void;
  icon: string;
  title: string;
  subtitle: string;
  className: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[84px] w-full items-center gap-4 rounded-[20px] px-4 py-3 text-left text-white transition-transform duration-200 active:scale-[0.98] ${className}`}
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-3xl">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-2xl font-bold">{title}</span>
        <span className="block truncate text-sm text-white/90">{subtitle}</span>
      </span>
    </button>
  );
}

/** Половинная плашка «трат» на главном экране. */
function HalfTile({ onClick, icon, title, subtitle }: { onClick: () => void; icon: string; title: string; subtitle: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[112px] w-full flex-col justify-between rounded-[20px] bg-spend p-3.5 text-left text-white shadow-[0_8px_24px_rgb(242_107_74/0.3)] transition-transform duration-200 active:scale-[0.97]"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20 text-2xl font-bold">{icon}</span>
      <span className="min-w-0">
        <span className="block text-xl font-bold leading-tight">{title}</span>
        <span className="block truncate text-xs text-white/90">{subtitle}</span>
      </span>
    </button>
  );
}
