import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { ensureSeeded } from './db/actions';
import './index.css';

// Офлайн-режим: service worker кеширует приложение и сам обновляет его при новой версии.
registerSW({ immediate: true });

// Просим браузер не удалять данные при нехватке места (особенно важно для iPhone).
navigator.storage?.persist?.().catch(() => {});

ensureSeeded()
  .catch((e) => console.error('Не удалось создать стартовые данные', e))
  .finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
