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
import { money, plural, sum } from '../lib/format';
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

  const incomeCount = incomes.filter((i) => inRange(i.date, month)).length;

  return (
    <Page>
      <header className="pb-3 pt-[calc(env(safe-area-inset-top)+20px)]">
        <div className="text-sm font-medium text-muted">{monthName(month.start)}</div>
        <h1 className="text-2xl font-bold">Финансовый аналитик</h1>
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
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Stat
            label="Доходы за месяц"
            value={money(incomeMonth)}
            tone="ok"
            hint={incomeCount ? `${incomeCount} ${plural(incomeCount, ['поступление', 'поступления', 'поступлений'])}` : 'добавить ›'}
            onClick={() => navigate('/income')}
          />
          <Stat label="Свободно" value={money(free)} tone={free < 0 ? 'over' : undefined} hint="доходы − лимиты − взносы" />
          <Stat label="Сэкономлено" value={money(saved)} hint="закрыто в этом месяце" tone="ok" />
          <Stat label="Всего в копилках" value={money(totalSaved)} tone="save" />
        </div>
      </section>

      {devTotal > 0 && (
        <button
          type="button"
          onClick={() => setDevOpen(true)}
          className="animate-pop-in mt-3 flex min-h-12 w-full items-center justify-between rounded-2xl bg-over-soft px-4 py-2.5 text-left font-semibold text-over"
        >
          <span>⚠️ Отклонения: {money(devTotal)}</span>
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
          onClick={() => navigate('/spend')}
          icon="👛"
          title="Потратить"
          subtitle={limitsMonth > 0 ? `осталось ${money(Math.max(0, limitsMonth - spentMonth))}` : 'статьи расходов'}
          className="bg-spend shadow-[0_8px_24px_rgb(242_107_74/0.3)]"
        />
        <BigTile
          onClick={() => navigate('/save')}
          icon="🐷"
          title="Накопить"
          subtitle={`накоплено ${money(totalSaved)}`}
          className="bg-save shadow-[0_8px_24px_rgb(18_165_148/0.3)]"
        />
      </div>

      <DeviationsSheet open={devOpen} onClose={() => setDevOpen(false)} />
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
      className={`flex min-h-[84px] w-full items-center gap-4 rounded-[20px] px-4 py-3 pr-20 text-left text-white transition-transform duration-200 active:scale-[0.98] ${className}`}
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-3xl">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-2xl font-bold">{title}</span>
        <span className="block truncate text-sm text-white/90">{subtitle}</span>
      </span>
    </button>
  );
}
