import { lazy, Suspense, useEffect, useState } from 'react';
import { useRoute, type Route } from './hooks/useRoute';
import { useSettings } from './hooks/useData';
import { BottomNav, Fab } from './components/layout';
import { ExpenseSheet } from './components/ExpenseSheet';
import { FeedbackProvider } from './components/ui/feedback';
import { AutoCloseSummary } from './components/AutoCloseSummary';
import { autoCloseExpired } from './db/autoClose';
import type { CloseResult } from './db/actions';
import { Home } from './screens/Home';
import { Spend } from './screens/Spend';
import { CategoryDetail } from './screens/CategoryDetail';
import { Save } from './screens/Save';
import { JarDetail } from './screens/JarDetail';
import { Income } from './screens/Income';
import { Settings } from './screens/Settings';

// Графики (Recharts) загружаются отдельно, только когда открыта «Аналитика».
const Analytics = lazy(() => import('./screens/Analytics').then((m) => ({ default: m.Analytics })));

function Screen({ route }: { route: Route }) {
  switch (route.name) {
    case 'home':
      return <Home />;
    case 'spend':
      return <Spend />;
    case 'category':
      return <CategoryDetail key={route.id} id={route.id} />;
    case 'save':
      return <Save />;
    case 'jar':
      return <JarDetail key={route.id} id={route.id} />;
    case 'income':
      return <Income />;
    case 'analytics':
      return (
        <Suspense fallback={<p className="p-8 text-center text-muted">Загрузка…</p>}>
          <Analytics />
        </Suspense>
      );
    case 'settings':
      return <Settings />;
  }
}

/** При запуске и при возвращении в приложение закрывает истёкшие периоды. */
function useAutoClose() {
  const [results, setResults] = useState<CloseResult[]>([]);
  useEffect(() => {
    const check = () => {
      if (document.visibilityState !== 'visible') return;
      autoCloseExpired()
        .then((r) => {
          if (!r.length) return;
          // Один и тот же проход может вернуться дважды — не дублируем записи.
          setResults((prev) => [...prev, ...r.filter((x) => !prev.some((p) => p.record.id === x.record.id))]);
        })
        .catch((e) => console.error('Автозакрытие периодов не удалось', e));
    };
    check();
    document.addEventListener('visibilitychange', check);
    return () => document.removeEventListener('visibilitychange', check);
  }, []);
  return { results, clear: () => setResults([]) };
}

/** Применяет выбранную тему и следит за системной, если выбрана «Системная». */
function useApplyTheme() {
  const { theme } = useSettings();
  useEffect(() => {
    try {
      localStorage.setItem('theme', theme);
    } catch {
      /* приватный режим — не страшно */
    }
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches);
      document.documentElement.classList.toggle('dark', dark);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#121212' : '#f6f5f2');
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}

export default function App() {
  const route = useRoute();
  const [quickAdd, setQuickAdd] = useState(false);
  useApplyTheme();
  const autoClose = useAutoClose();

  // На главной для трат теперь свои плашки, «+» остаётся во вкладке «Траты».
  const showFab = route.name === 'spend';

  return (
    <FeedbackProvider>
      {/* Каркас: прокручиваемая область + нижнее меню, без position: fixed */}
      <div className="flex h-full flex-col">
        <div className="relative min-h-0 flex-1">
          <div id="scroller" className="absolute inset-0 overflow-y-auto overscroll-contain">
            <Screen route={route} />
          </div>
          {showFab && <Fab label="Добавить трату" onClick={() => setQuickAdd(true)} />}
        </div>
        <BottomNav route={route} />
      </div>
      <ExpenseSheet open={quickAdd} onClose={() => setQuickAdd(false)} />
      <AutoCloseSummary results={autoClose.results} onClose={autoClose.clear} />
    </FeedbackProvider>
  );
}
