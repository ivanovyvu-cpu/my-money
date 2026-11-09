import { useEffect, useState } from 'react';

// Простая навигация через адрес после «#» (#/spend, #/spend/<id> …).
// Хеш-адреса работают на GitHub Pages и внутри Capacitor без настройки сервера.

export type Route =
  | { name: 'home' }
  | { name: 'spend' }
  | { name: 'category'; id: string }
  | { name: 'save' }
  | { name: 'jar'; id: string }
  | { name: 'income' }
  | { name: 'analytics' }
  | { name: 'settings' };

export function parseHash(hash: string): Route {
  const [, a, b] = hash.replace(/^#/, '').split('/');
  switch (a) {
    case 'spend':
      return b ? { name: 'category', id: decodeURIComponent(b) } : { name: 'spend' };
    case 'save':
      return b ? { name: 'jar', id: decodeURIComponent(b) } : { name: 'save' };
    case 'income':
    case 'analytics':
    case 'settings':
      return { name: a };
    default:
      return { name: 'home' };
  }
}

export function navigate(path: string) {
  window.location.hash = path;
}

// Стек посещённых адресов: «Назад» в приложении совпадает с системной кнопкой «Назад».
const stack: string[] = [normalize(window.location.hash)];

function normalize(h: string): string {
  const v = h.replace(/^#/, '');
  return v === '' ? '/' : v;
}

/** Вернуться к родительскому экрану (parent), не плодя лишних записей в истории. */
export function goBack(parent = '/') {
  if (stack.length > 1 && stack[stack.length - 2] === parent) history.back();
  else {
    stack[stack.length - 1] = parent;
    window.location.replace('#' + parent);
  }
}

function track(hash: string) {
  const h = normalize(hash);
  if (stack.length > 1 && stack[stack.length - 2] === h) stack.pop();
  else if (stack[stack.length - 1] !== h) stack.push(h);
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const on = () => {
      track(window.location.hash);
      setRoute(parseHash(window.location.hash));
      document.getElementById('scroller')?.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
