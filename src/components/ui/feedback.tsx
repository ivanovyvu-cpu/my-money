import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Sheet } from './Sheet';
import { Button } from './controls';

// Подтверждения («Точно удалить?») и всплывающие сообщения, доступные из любого экрана.

interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

interface FeedbackApi {
  confirm: (o: ConfirmOptions) => Promise<boolean>;
  toast: (text: string, action?: ToastAction) => void;
}

interface ToastAction {
  label: string;
  onClick: () => void;
}

const Ctx = createContext<FeedbackApi | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);
  const [toasts, setToasts] = useState<Array<{ id: number; text: string; action?: ToastAction }>>([]);

  const confirm = useCallback((o: ConfirmOptions) => {
    setDialog(o);
    return new Promise<boolean>((res) => {
      resolver.current = res;
    });
  }, []);

  const close = useCallback((v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setDialog(null);
  }, []);

  const toast = useCallback((text: string, action?: ToastAction) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, action }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), action ? 5000 : 2600);
  }, []);

  return (
    <Ctx.Provider value={{ confirm, toast }}>
      {children}
      <Sheet open={!!dialog} onClose={() => close(false)} title={dialog?.title}>
        {dialog?.message && <div className="mb-5 text-muted">{dialog.message}</div>}
        <div className="flex flex-col gap-2">
          <Button variant={dialog?.danger ? 'danger' : 'primary'} block onClick={() => close(true)}>
            {dialog?.confirmText ?? 'Да'}
          </Button>
          <Button variant="ghost" block onClick={() => close(false)}>
            {dialog?.cancelText ?? 'Отмена'}
          </Button>
        </div>
      </Sheet>
      {createPortal(
        <div className="pointer-events-none fixed inset-x-0 top-0 z-[70] flex flex-col items-center gap-2 px-4 pt-[calc(env(safe-area-inset-top)+8px)]">
          {toasts.map((t) => (
            <div
              key={t.id}
              className="animate-pop-in pointer-events-auto mt-2 flex items-center gap-3 rounded-2xl bg-text py-2 pl-4 pr-2 text-sm font-medium text-bg shadow-soft"
            >
              <span className="py-1">{t.text}</span>
              {t.action && (
                <button
                  type="button"
                  className="min-h-9 rounded-xl bg-bg/15 px-3 font-semibold"
                  onClick={() => {
                    t.action!.onClick();
                    setToasts((all) => all.filter((x) => x.id !== t.id));
                  }}
                >
                  {t.action.label}
                </button>
              )}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </Ctx.Provider>
  );
}

export function useFeedback(): FeedbackApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('FeedbackProvider не подключён');
  return v;
}
