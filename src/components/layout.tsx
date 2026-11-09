import type { ReactNode } from 'react';
import { goBack, navigate, type Route } from '../hooks/useRoute';

export function ScreenHeader({
  title,
  back,
  right,
  accent,
}: {
  title: ReactNode;
  /** Адрес родительского экрана; если задан — показывается стрелка «Назад». */
  back?: string;
  right?: ReactNode;
  accent?: 'spend' | 'save';
}) {
  return (
    <header className="sticky top-0 z-30 bg-bg/90 pt-[calc(env(safe-area-inset-top)+8px)] backdrop-blur">
      <div className="mx-auto flex min-h-14 max-w-[480px] items-center gap-1 px-2">
        {back !== undefined ? (
          <button
            type="button"
            onClick={() => goBack(back)}
            aria-label="Назад"
            className="flex h-11 w-11 items-center justify-center rounded-full text-2xl hover:bg-card-2"
          >
            ‹
          </button>
        ) : (
          <div className="w-3" />
        )}
        <h1
          className={`flex-1 truncate text-xl font-bold ${accent === 'spend' ? 'text-spend' : accent === 'save' ? 'text-save' : ''}`}
        >
          {title}
        </h1>
        {right}
      </div>
    </header>
  );
}

const NAV: Array<{ path: string; label: string; icon: string; match: Route['name'][] }> = [
  { path: '/', label: 'Главная', icon: '🏠', match: ['home', 'spend', 'category', 'save', 'jar'] },
  { path: '/income', label: 'Доходы', icon: '💵', match: ['income'] },
  { path: '/analytics', label: 'Аналитика', icon: '📊', match: ['analytics'] },
  { path: '/settings', label: 'Настройки', icon: '⚙️', match: ['settings'] },
];

export function BottomNav({ route }: { route: Route }) {
  return (
    <nav className="pb-safe relative z-40 shrink-0 border-t border-line bg-card">
      <div className="mx-auto flex max-w-[480px]">
        {NAV.map((n) => {
          const active = n.match.includes(route.name);
          return (
            <button
              key={n.path}
              type="button"
              onClick={() => (active && n.path === '/' && route.name !== 'home' ? navigate('/') : navigate(n.path))}
              className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
                active ? 'text-text' : 'text-muted'
              }`}
            >
              <span className={`text-xl transition-transform duration-150 ${active ? 'scale-110' : 'opacity-70 grayscale'}`}>
                {n.icon}
              </span>
              {n.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/** Круглая плавающая кнопка «+» в правом нижнем углу (над нижним меню). */
export function Fab({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="absolute bottom-4 right-[max(16px,calc(50%-224px))] z-40 flex h-16 w-16 items-center justify-center rounded-full bg-spend text-4xl font-light text-white shadow-[0_8px_24px_rgb(242_107_74/0.45)] transition-transform duration-150 active:scale-95"
    >
      +
    </button>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return <main className="mx-auto max-w-[480px] px-4 pb-28">{children}</main>;
}
