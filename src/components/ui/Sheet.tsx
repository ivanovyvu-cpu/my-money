import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
}

/**
 * Видимая часть экрана. На iPhone клавиатура не уменьшает страницу, а перекрывает её,
 * поэтому окно подстраиваем под область над клавиатурой (visualViewport).
 */
function useVisibleArea(active: boolean) {
  const [area, setArea] = useState<{ top: number; height: number } | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!active || !vv) return;
    const update = () => setArea({ top: vv.offsetTop, height: vv.height });
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [active]);
  return area;
}

/** Нижнее окно-лист: выезжает снизу, закрывается по фону, крестику или Esc. */
export function Sheet({ open, onClose, title, children }: Props) {
  const area = useVisibleArea(open);
  // Клавиатура открыта, если видимая область заметно меньше окна.
  const keyboard = !!area && window.innerHeight - area.height > 120;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-x-0 z-50 flex items-end justify-center"
      style={area ? { top: area.top, height: area.height } : { top: 0, bottom: 0 }}
      role="dialog"
      aria-modal="true"
    >
      <div className="animate-fade-in absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className={`animate-slide-up relative flex w-full max-w-[480px] flex-col rounded-t-3xl bg-card shadow-soft ${
          keyboard ? 'max-h-[calc(100%-8px)]' : 'pb-safe max-h-[calc(100%-env(safe-area-inset-top)-24px)]'
        }`}
      >
        <div className="flex shrink-0 items-center gap-2 px-5 pt-3">
          <div className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-line" />
          <h2 className="flex-1 pt-3 text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="mt-2 flex h-11 w-11 items-center justify-center rounded-full text-2xl text-muted hover:bg-card-2"
          >
            ×
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain px-5 pb-5 pt-2">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
