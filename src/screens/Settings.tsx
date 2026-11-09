import { useRef, useState } from 'react';
import type { Theme } from '../db/types';
import { createStarterData, restoreCategory, updateSettings } from '../db/actions';
import { db } from '../db/db';
import { exportToFile, parseBackup, restoreBackup, wipeAll } from '../db/backup';
import { fillDemoData } from '../db/demo';
import { useCategories, useJars, useSettings } from '../hooks/useData';
import { Page, ScreenHeader } from '../components/layout';
import { Button, Segmented } from '../components/ui/controls';
import { useFeedback } from '../components/ui/feedback';
import { QuickTemplatesSection } from '../components/QuickTemplates';

const THEMES: Array<{ value: Theme; label: string }> = [
  { value: 'light', label: 'Светлая' },
  { value: 'dark', label: 'Тёмная' },
  { value: 'system', label: 'Системная' },
];

const LABELS: Record<string, string> = {
  categories: 'статей',
  expenses: 'трат',
  jars: 'копилок',
  jarOperations: 'операций в копилках',
  incomes: 'поступлений',
  closedPeriods: 'закрытых периодов',
  deviations: 'записей о перерасходе',
  quickTemplates: 'быстрых кнопок',
};

export function Settings() {
  const settings = useSettings();
  const { confirm, toast } = useFeedback();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const archivedCats = useCategories(true).filter((c) => c.archived);
  const archivedJars = useJars(true).filter((j) => j.archived);

  async function onExport() {
    try {
      const how = await exportToFile();
      toast(how === 'shared' ? 'Копия готова — сохраните её в надёжное место' : 'Файл резервной копии скачан');
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast('Не удалось сохранить файл');
    }
  }

  async function onImportFile(file: File) {
    try {
      const { backup, counts } = parseBackup(await file.text());
      const summary = Object.entries(LABELS)
        .map(([k, l]) => `${counts[k] ?? 0} ${l}`)
        .join(', ');
      const ok = await confirm({
        title: 'Заменить данные из копии?',
        message: (
          <>
            <p className="mb-2">
              В файле: {summary}. Копия от {new Date(backup.exportedAt).toLocaleString('ru-RU')}.
            </p>
            <p className="font-semibold text-over">Все текущие данные на этом устройстве будут заменены.</p>
          </>
        ),
        confirmText: 'Заменить',
        danger: true,
      });
      if (!ok) return;
      setBusy(true);
      await restoreBackup(backup);
      toast('Данные восстановлены');
    } catch (e) {
      toast((e as Error).message || 'Не удалось прочитать файл');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function onDemo() {
    const ok = await confirm({
      title: 'Заполнить примером?',
      message: 'Текущие данные будут заменены демонстрационными за 6 месяцев. Если нужно — сначала сделайте резервную копию.',
      confirmText: 'Заполнить',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await fillDemoData();
      toast('Готово! Загляните на главный экран');
    } finally {
      setBusy(false);
    }
  }

  async function onReset() {
    const first = await confirm({
      title: 'Удалить все данные?',
      message: 'Будут удалены все статьи, траты, копилки, доходы и история.',
      confirmText: 'Продолжить',
      danger: true,
    });
    if (!first) return;
    const second = await confirm({
      title: 'Точно? Это нельзя отменить',
      message: 'Если нет резервной копии — данные пропадут навсегда.',
      confirmText: 'Да, удалить всё',
      danger: true,
    });
    if (!second) return;
    const { theme, monthStartDay } = settings;
    await wipeAll();
    await db.settings.put({ key: 'app', theme, monthStartDay, seeded: true });
    await createStarterData(monthStartDay);
    toast('Все данные удалены');
  }

  return (
    <>
      <ScreenHeader title="⚙️ Настройки" />
      <Page>
        <Section title="Резервная копия">
          <p className="mb-3 text-sm text-muted">
            Данные хранятся только на этом устройстве. Регулярно сохраняйте копию (например, раз в неделю) в облако или
            себе в мессенджер — это единственная защита от потери.
          </p>
          <div className="flex flex-col gap-2">
            <Button variant="primary" block onClick={onExport} disabled={busy}>
              ⬇️ Сохранить копию (JSON)
            </Button>
            <Button variant="soft" block onClick={() => fileRef.current?.click()} disabled={busy}>
              ⬆️ Восстановить из файла
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onImportFile(e.target.files[0])}
            />
          </div>
        </Section>

        <Section title="⚡ Быстрые траты">
          <QuickTemplatesSection />
        </Section>

        <Section title="Тема">
          <Segmented
            options={THEMES}
            value={settings.theme}
            onChange={(theme) => updateSettings({ theme })}
          />
        </Section>

        <Section title="Начало месяца">
          <p className="mb-3 text-sm text-muted">
            С какого числа начинается «финансовый месяц» — например, с дня зарплаты. Влияет на месячные, квартальные и
            годовые периоды.
          </p>
          <div className="flex items-center gap-3">
            <Button
              variant="soft"
              className="w-12 px-0 text-xl"
              disabled={settings.monthStartDay <= 1}
              onClick={() => updateSettings({ monthStartDay: settings.monthStartDay - 1 })}
            >
              −
            </Button>
            <div className="flex-1 text-center">
              <div className="text-2xl font-bold">{settings.monthStartDay}</div>
              <div className="text-xs text-muted">число месяца</div>
            </div>
            <Button
              variant="soft"
              className="w-12 px-0 text-xl"
              disabled={settings.monthStartDay >= 28}
              onClick={() => updateSettings({ monthStartDay: settings.monthStartDay + 1 })}
            >
              +
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted">Новое значение применится к новым статьям и следующим периодам.</p>
        </Section>

        {(archivedCats.length > 0 || archivedJars.length > 0) && (
          <Section title="Архив">
            <ul className="flex flex-col gap-2">
              {archivedCats.map((c) => (
                <ArchivedRow key={c.id} label={`${c.icon} ${c.name}`} kind="статья" onRestore={() => restoreCategory(c.id)} />
              ))}
              {archivedJars.map((j) => (
                <ArchivedRow key={j.id} label={`${j.icon} ${j.name}`} kind="копилка" onRestore={() => db.jars.update(j.id, { archived: false })} />
              ))}
            </ul>
          </Section>
        )}

        <Section title="Демо и сброс">
          <div className="flex flex-col gap-2">
            <Button variant="soft" block onClick={onDemo} disabled={busy}>
              ✨ Заполнить примером
            </Button>
            <Button variant="ghost" block className="text-over" onClick={onReset} disabled={busy}>
              Сбросить все данные
            </Button>
          </div>
        </Section>

        <p className="mt-6 text-center text-xs text-muted">
          Финансовый аналитик · версия {__APP_VERSION__}
          <br />
          Работает без интернета, данные не покидают устройство.
        </p>
      </Page>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4 rounded-[20px] bg-card p-4 shadow-soft">
      <h2 className="mb-2 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function ArchivedRow({ label, kind, onRestore }: { label: string; kind: string; onRestore: () => void }) {
  return (
    <li className="flex items-center gap-2 rounded-2xl bg-card-2 p-2 pl-3">
      <span className="min-w-0 flex-1 truncate">
        {label} <span className="text-xs text-muted">· {kind}</span>
      </span>
      <Button variant="ghost" className="min-h-11 px-3 text-sm" onClick={onRestore}>
        Вернуть
      </Button>
    </li>
  );
}
