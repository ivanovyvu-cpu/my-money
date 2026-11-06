import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
}

/** Нижнее окно-лист: выезжает снизу, закрывается по фону, крестику или Esc. */
export function Sheet({ open, onClose, title, children }: Props) {
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
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <div className="animate-fade-in absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="animate-slide-up pb-safe relative flex max-h-[92dvh] w-full max-w-[480px] flex-col rounded-t-3xl bg-card shadow-soft">
        <div className="flex items-center gap-2 px-5 pt-3">
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
        <div className="overflow-y-auto px-5 pb-5 pt-2">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
