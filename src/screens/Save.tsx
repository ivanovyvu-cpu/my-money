import { useState } from 'react';
import { addJar } from '../db/actions';
import { navigate } from '../hooks/useRoute';
import { useJarOperations, useJars } from '../hooks/useData';
import { jarStats } from '../lib/calc';
import { monthsUntil } from '../lib/dates';
import { money, sum } from '../lib/format';
import { Page, ScreenHeader } from '../components/layout';
import { AddTile } from '../components/categories';
import { JarForm, JarOpSheet, JarTile } from '../components/jars';
import { Button } from '../components/ui/controls';
import { useFeedback } from '../components/ui/feedback';

export function Save() {
  const jars = useJars();
  const ops = useJarOperations();
  const { toast } = useFeedback();
  const [adding, setAdding] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [depositOpen, setDepositOpen] = useState(false);

  const rows = jars.map((j) => ({ jar: j, st: jarStats(j, ops, j.targetDate ? monthsUntil(j.targetDate) : undefined) }));
  const total = sum(rows, (r) => r.st.saved);

  return (
    <>
      <ScreenHeader title="🐷 Накопить" back="/" accent="save" />
      <Page>
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm text-muted">
            Всего накоплено: <b className="text-text">{money(total)}</b>
          </p>
          <Button variant="save" className="min-h-11 px-4 text-sm" onClick={() => setDepositOpen(true)}>
            + Внести
          </Button>
        </div>
        <div className="flex flex-col gap-3">
          {rows.map(({ jar, st }) => (
            <JarTile key={jar.id} jar={jar} st={st} onClick={() => navigate(`/save/${jar.id}`)} />
          ))}
          <AddTile
            label="Добавить копилку"
            accent="save"
            open={adding}
            onToggle={(v) => {
              setAdding(v);
              if (v) setFormKey((k) => k + 1);
            }}
          >
            <JarForm
              key={formKey}
              submitText="Создать"
              onCancel={() => setAdding(false)}
              onSubmit={async (v) => {
                await addJar(v);
                setAdding(false);
                toast(`Копилка «${v.name}» создана`);
              }}
            />
          </AddTile>
        </div>
      </Page>
      <JarOpSheet open={depositOpen} onClose={() => setDepositOpen(false)} type="deposit" />
    </>
  );
}
