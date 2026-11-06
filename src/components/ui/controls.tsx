import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'spend' | 'save' | 'ghost' | 'danger' | 'soft';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-text text-bg',
  spend: 'bg-spend text-white',
  save: 'bg-save text-white',
  ghost: 'bg-transparent text-text hover:bg-card-2',
  danger: 'bg-over text-white',
  soft: 'bg-card-2 text-text',
};

export function Button({
  variant = 'primary',
  className = '',
  block,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; block?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      className={`min-h-12 rounded-2xl px-5 font-semibold transition-[transform,opacity] duration-150 active:scale-[0.98] disabled:opacity-40 ${
        VARIANTS[variant]
      } ${block ? 'w-full' : ''} ${className}`}
    />
  );
}

export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1.5 block text-sm font-medium text-muted">{label}</span>
      {children}
      {error && <span className="mt-1 block text-sm text-over">{error}</span>}
    </label>
  );
}

const inputCls =
  'h-12 w-full rounded-2xl border border-line bg-bg px-4 text-base text-text outline-none transition-colors focus:border-text/40';

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="text" {...props} className={`${inputCls} ${props.className ?? ''}`} />;
}

/** Поле суммы: цифровая клавиатура на телефоне, знак ₽ справа. */
export function MoneyInput({
  value,
  onChange,
  autoFocus,
  large,
}: {
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
  large?: boolean;
}) {
  return (
    <div className="relative">
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.,\s]/g, ''))}
        className={`${inputCls} pr-10 ${large ? 'h-16 text-3xl font-semibold' : ''}`}
      />
      <span className={`pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted ${large ? 'text-2xl' : ''}`}>
        ₽
      </span>
    </div>
  );
}

export function DateInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="date" {...props} className={`${inputCls} appearance-none`} />;
}

/** Переключатель-«таблетки» для выбора одного варианта. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-2xl bg-card-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`min-h-11 flex-1 rounded-xl px-2 text-sm font-medium transition-colors duration-150 ${
            value === o.value ? 'bg-card text-text shadow-soft' : 'text-muted'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Горизонтальный ряд «чипов» (например, выбор статьи). */
export function Chips<T extends string>({
  items,
  value,
  onChange,
  accent = 'spend',
}: {
  items: Array<{ id: T; label: string; icon?: string; disabled?: boolean }>;
  value: T | null;
  onChange: (v: T) => void;
  accent?: 'spend' | 'save';
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it) => {
        const active = it.id === value;
        return (
          <button
            key={it.id}
            type="button"
            disabled={it.disabled}
            onClick={() => onChange(it.id)}
            className={`min-h-11 rounded-full border px-3.5 text-sm font-medium transition-colors duration-150 disabled:opacity-40 ${
              active
                ? accent === 'spend'
                  ? 'border-spend bg-spend-soft text-text'
                  : 'border-save bg-save-soft text-text'
                : 'border-line bg-card text-text'
            }`}
          >
            {it.icon && <span className="mr-1">{it.icon}</span>}
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

export function ProgressBar({ ratio, status }: { ratio: number; status: 'ok' | 'warn' | 'over' | 'save' }) {
  const color = { ok: 'bg-ok', warn: 'bg-warn', over: 'bg-over', save: 'bg-save' }[status];
  const pct = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 1)) * 100;
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-card-2">
      <div className={`h-full rounded-full ${color} transition-[width] duration-300`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Card({ className = '', children, onClick }: { className?: string; children: ReactNode; onClick?: () => void }) {
  const cls = `rounded-[16px] bg-card p-4 shadow-soft ${className}`;
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={`${cls} block w-full text-left transition-transform duration-150 active:scale-[0.99]`}>
        {children}
      </button>
    );
  return <div className={cls}>{children}</div>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-muted">{children}</p>;
}
