import { useEffect, useState } from 'react';
import type { Expense } from '../db/types';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useCategories, useClosedPeriods, useExpenses, useSettings } from '../hooks/useData';
import { inRange } from '../lib/calc';
import { addDays, formatDate, monthName, monthRange, monthShort, today } from '../lib/dates';
import { money, sum } from '../lib/format';
import { Page, ScreenHeader } from '../components/layout';
import { EmptyState } from '../components/ui/controls';
import { OperationsSheet } from '../components/OperationsSheet';
import { categoryColorIndex } from '../lib/colors';

/** Читает цвета из CSS-переменных и обновляет их при смене темы. */
function useThemeColors() {
  const read = () => {
    const cs = getComputedStyle(document.documentElement);
    const v = (n: string) => cs.getPropertyValue(n).trim();
    return {
      series: [1, 2, 3, 4, 5, 6, 7, 8].map((i) => v(`--series-${i}`)),
      other: v('--series-other'),
      spend: v('--spend'),
      card: v('--card'),
      line: v('--line'),
      muted: v('--muted'),
      text: v('--text'),
    };
  };
  const [c, setC] = useState(read);
  useEffect(() => {
    const mo = new MutationObserver(() => setC(read()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, []);
  return c;
}

const compact = new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 });

export function Analytics() {
  const categories = useCategories(true);
  const expenses = useExpenses();
  const closed = useClosedPeriods();
  const { monthStartDay } = useSettings();
  const col = useThemeColors();
  // Какие операции показать: фильтр пересчитывается вживую, поэтому правки сразу видны.
  const [ops, setOps] = useState<{ title: string; subtitle?: string; filter: (e: Expense) => boolean } | null>(null);

  const month = monthRange(today(), monthStartDay);
  // Цвет закреплён за статьёй (по её порядку), а не за местом в рейтинге.
  const colorOf = (catId: string) => {
    const n = categoryColorIndex(catId, categories);
    return n ? col.series[n - 1] : col.other;
  };
  const showCategory = (id: string) => {
    const c = categories.find((x) => x.id === id);
    setOps({
      title: `${c?.icon ?? ''} ${c?.name ?? 'Статья'}`,
      subtitle: monthName(month.start),
      filter: (e) => e.categoryId === id && inRange(e.date, month),
    });
  };

  const pieData = categories
    .map((c) => ({
      id: c.id,
      name: `${c.icon} ${c.name}`,
      value: sum(expenses.filter((e) => e.categoryId === c.id && inRange(e.date, month)), (e) => e.amount),
    }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);
  const pieTotal = sum(pieData, (d) => d.value);

  const months = [month];
  for (let i = 0; i < 5; i++) months.unshift(monthRange(addDays(months[0].start, -1), monthStartDay));
  const barData = months.map((m) => ({
    range: m,
    label: monthShort(m.start),
    full: monthName(m.start),
    value: sum(expenses.filter((e) => inRange(e.date, m)), (e) => e.amount),
  }));

  const table = [...closed].sort((a, b) => b.end.localeCompare(a.end)).slice(0, 30);

  const tooltipStyle = {
    background: col.card,
    border: `1px solid ${col.line}`,
    borderRadius: 12,
    color: col.text,
    fontSize: 13,
  };

  return (
    <>
      <ScreenHeader title="📊 Аналитика" />
      <Page>
        <section className="rounded-[20px] bg-card p-4 shadow-soft">
          <button
            type="button"
            className="block w-full text-left"
            disabled={pieData.length === 0}
            onClick={() => setOps({ title: 'Все траты месяца', subtitle: monthName(month.start), filter: (e) => inRange(e.date, month) })}
          >
            <h2 className="font-semibold">Траты по статьям</h2>
            <p className="text-sm text-muted">
              {monthName(month.start)} · <span className="text-text">{money(pieTotal)}</span>
              {pieData.length > 0 && ' ›'}
            </p>
          </button>
          {pieData.length === 0 ? (
            <EmptyState>В этом месяце трат пока нет</EmptyState>
          ) : (
            <>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="58%"
                      outerRadius="92%"
                      paddingAngle={1}
                      stroke={col.card}
                      strokeWidth={2}
                      isAnimationActive={false}
                      onClick={(_, i) => pieData[i] && showCategory(pieData[i].id)}
                      className="cursor-pointer"
                    >
                      {pieData.map((d) => (
                        <Cell key={d.id} fill={colorOf(d.id)} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => money(Number(v))} contentStyle={tooltipStyle} itemStyle={{ color: col.text }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Легенда одновременно служит таблицей значений */}
              <ul className="mt-2 flex flex-col">
                {pieData.map((d) => (
                  <li key={d.id} className="border-b border-line last:border-0">
                    <button
                      type="button"
                      onClick={() => showCategory(d.id)}
                      className="flex min-h-11 w-full items-center gap-2 py-2 text-left text-sm active:bg-card-2"
                    >
                      <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: colorOf(d.id) }} />
                      <span className="min-w-0 flex-1 truncate">{d.name}</span>
                      <span className="text-muted">{Math.round((d.value / pieTotal) * 100)}%</span>
                      <span className="w-24 text-right font-semibold">{money(d.value)}</span>
                      <span className="text-muted">›</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="mt-4 rounded-[20px] bg-card p-4 shadow-soft">
          <h2 className="font-semibold">Траты по месяцам</h2>
          <p className="text-sm text-muted">последние 6 месяцев · нажмите на столбик, чтобы увидеть операции</p>
          <div className="mt-3 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={barData}
                margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
                className="cursor-pointer"
                onClick={(st) => {
                  const d = barData[Number(st?.activeTooltipIndex)];
                  if (d) setOps({ title: `Траты · ${d.full}`, filter: (e) => inRange(e.date, d.range) });
                }}
              >
                <CartesianGrid vertical={false} stroke={col.line} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: col.muted, fontSize: 12 }} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tick={{ fill: col.muted, fontSize: 11 }}
                  tickFormatter={(v: number) => compact.format(v)}
                />
                <Tooltip
                  cursor={{ fill: col.line, opacity: 0.4 }}
                  formatter={(v) => [money(Number(v)), 'Потрачено']}
                  labelFormatter={(_, p) => (p?.[0]?.payload as { full?: string } | undefined)?.full ?? ''}
                  contentStyle={tooltipStyle}
                  itemStyle={{ color: col.text }}
                />
                <Bar dataKey="value" fill={col.spend} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="mt-4 rounded-[20px] bg-card p-4 shadow-soft">
          <h2 className="font-semibold">Лимит и факт по закрытым периодам</h2>
          <p className="mb-2 text-sm text-muted">нажмите на строку, чтобы увидеть операции</p>
          {table.length === 0 ? (
            <EmptyState>Закрытых периодов пока нет</EmptyState>
          ) : (
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th className="px-1 py-2 font-medium">Статья</th>
                    <th className="px-1 py-2 text-right font-medium">Лимит</th>
                    <th className="px-1 py-2 text-right font-medium">Факт</th>
                    <th className="px-1 py-2 text-right font-medium">Разница</th>
                  </tr>
                </thead>
                <tbody>
                  {table.map((p) => {
                    const c = categories.find((x) => x.id === p.categoryId);
                    return (
                      <tr
                        key={p.id}
                        className="cursor-pointer border-t border-line active:bg-card-2"
                        onClick={() =>
                          setOps({
                            title: `${c?.icon ?? ''} ${c?.name ?? 'Статья'}`,
                            subtitle: `${formatDate(p.start)} — ${formatDate(p.end)}`,
                            filter: (e) => e.categoryId === p.categoryId && inRange(e.date, { start: p.start, end: p.end }),
                          })
                        }
                      >
                        <td className="px-1 py-2">
                          <div className="max-w-[9rem] truncate">
                            {c?.icon} {c?.name ?? 'Удалена'}
                          </div>
                          <div className="text-xs text-muted">
                            {formatDate(p.start)} — {formatDate(p.end)}
                          </div>
                        </td>
                        <td className="px-1 py-2 text-right whitespace-nowrap">{money(p.limit)}</td>
                        <td className="px-1 py-2 text-right whitespace-nowrap">{money(p.spent)}</td>
                        <td className={`px-1 py-2 text-right font-semibold whitespace-nowrap ${p.difference < 0 ? 'text-over' : 'text-ok'}`}>
                          {p.difference > 0 ? '+' : p.difference < 0 ? '−' : ''}
                          {money(Math.abs(p.difference))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </Page>
      <OperationsSheet
        open={!!ops}
        onClose={() => setOps(null)}
        title={ops?.title ?? ''}
        subtitle={ops?.subtitle}
        expenses={ops ? expenses.filter(ops.filter) : []}
      />
    </>
  );
}
