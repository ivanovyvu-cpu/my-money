import { useState } from 'react';
import { navigate } from '../hooks/useRoute';
import {
  useCategories,
  useClosedPeriods,
  useDeviations,
  useExpenses,
  useIncomes,
  useJarOperations,
  useJars,
  useSettings,
} from '../hooks/useData';
import { categoryStats, inRange, jarBalance, monthlyLimit } from '../lib/calc';
import { monthName, monthRange, toISO, today } from '../lib/dates';
import { money, sum } from '../lib/format';
import { Page } from '../components/layout';
import { DeviationsSheet } from '../components/DeviationsSheet';

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

  const month = monthRange(today(), settings.monthStartDay);
  const catIds = new Set(categories.map((c) => c.id));
  const monthExpenses = expenses.filter((e) => inRange(e.date, month) && catIds.has(e.categoryId));
  const spentMonth = sum(monthExpenses, (e) => e.amount);
  const limitsMonth = sum(categories, (c) => monthlyLimit(c.limit, c.period));

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
  const free = incomeMonth - limitsMonth - depositsMonth;
  const devTotal = sum(deviations, (d) => d.amount);
  const expiredCount = categories.filter((c) => categoryStats(c, expenses, settings.monthStartDay).expired).length;

  return (
    <Page>
      <header className="pt-safe flex items-center justify-between pb-2 pt-5">
        <div>
          <div className="text-sm text-muted">{monthName(month.start)}</div>
          <h1 className="text-2xl font-bold">Финансовый аналитик</h1>
        </div>
      </header>

      <section className="rounded-[20px] bg-card p-4 shadow-soft">
        <div className="text-sm text-muted">Потрачено за месяц</div>
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
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Stat label="Больше всего" value={top ? `${top.icon} ${money(top.amount)}` : '—'} hint={top?.name} />
          <Stat label="Свободно к распределению" value={money(free)} tone={free < 0 ? 'over' : undefined} hint="доходы − лимиты − взносы" />
          <Stat label="Сэкономлено" value={money(saved)} hint="закрыто в этом месяце" tone="ok" />
          <Stat label="Всего в копилках" value={money(totalSaved)} tone="save" />
        </div>
      </section>

      {devTotal > 0 && (
        <button
          type="button"
          onClick={() => setDevOpen(true)}
          className="animate-pop-in mt-3 flex min-h-12 w-full items-center justify-between rounded-2xl bg-over-soft px-4 py-3 text-left font-semibold text-over"
        >
          <span>⚠️ Отклонения: {money(devTotal)}</span>
          <span className="text-xl">›</span>
        </button>
      )}

      {expiredCount > 0 && (
        <button
          type="button"
          onClick={() => navigate('/spend')}
          className="mt-3 flex min-h-12 w-full items-center justify-between rounded-2xl bg-warn/15 px-4 py-3 text-left font-medium"
        >
          <span>⏰ Есть незакрытые периоды: {expiredCount}</span>
          <span className="text-xl">›</span>
        </button>
      )}

      <div className="mt-6 flex flex-col items-center gap-5">
        <BigCircle
          onClick={() => navigate('/spend')}
          icon="👛"
          title="Потратить"
          subtitle={limitsMonth > 0 ? `осталось ${money(Math.max(0, limitsMonth - spentMonth))}` : 'статьи расходов'}
          className="bg-spend shadow-[0_12px_32px_rgb(242_107_74/0.35)]"
        />
        <BigCircle
          onClick={() => navigate('/save')}
          icon="🐷"
          title="Накопить"
          subtitle={`накоплено ${money(totalSaved)}`}
          className="bg-save shadow-[0_12px_32px_rgb(18_165_148/0.35)]"
        />
      </div>

      <DeviationsSheet open={devOpen} onClose={() => setDevOpen(false)} />
    </Page>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'ok' | 'over' | 'save' }) {
  const color = tone === 'over' ? 'text-over' : tone === 'ok' ? 'text-ok' : tone === 'save' ? 'text-save' : '';
  return (
    <div className="rounded-2xl bg-card-2 p-3">
      <div className="text-xs leading-tight text-muted">{label}</div>
      <div className={`mt-1 truncate text-lg font-bold ${color}`}>{value}</div>
      {hint && <div className="truncate text-xs text-muted">{hint}</div>}
    </div>
  );
}

function BigCircle({
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
      className={`flex aspect-square w-[min(64vw,260px)] flex-col items-center justify-center rounded-full text-white transition-transform duration-200 active:scale-95 ${className}`}
    >
      <span className="text-6xl drop-shadow-sm">{icon}</span>
      <span className="mt-2 text-2xl font-bold">{title}</span>
      <span className="mt-1 max-w-[80%] text-sm text-white/85">{subtitle}</span>
    </button>
  );
}
