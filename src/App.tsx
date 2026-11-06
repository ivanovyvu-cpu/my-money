import { lazy, Suspense, useEffect, useState } from 'react';
import { useRoute, type Route } from './hooks/useRoute';
import { useSettings } from './hooks/useData';
import { BottomNav, Fab } from './components/layout';
import { ExpenseSheet } from './components/ExpenseSheet';
import { FeedbackProvider } from './components/ui/feedback';
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

  const showFab = route.name === 'home' || route.name === 'spend';

  return (
    <FeedbackProvider>
      <Screen route={route} />
      {showFab && <Fab label="Добавить трату" onClick={() => setQuickAdd(true)} />}
      <BottomNav route={route} />
      <ExpenseSheet open={quickAdd} onClose={() => setQuickAdd(false)} />
    </FeedbackProvider>
  );
}
