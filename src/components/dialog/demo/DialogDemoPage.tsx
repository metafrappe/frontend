/**
 * Dialog test page. Opens only in the e2e build at `/_demo/dialog`.
 * The route row is in `src/shell/routes.ts`. The texts are sample data for tests.
 */
import { Button } from 'antd';

import { ActionDialog, ConfirmPopover, SidePanel } from '..';
import { useState } from 'react';

const DRAFTS = ['Mart taslağı', 'Nisan taslağı', 'Mayıs taslağı'];

const LONG_BODY = Array.from(
  { length: 12 },
  (_, i) => `Değişiklik ${i + 1}: rolün okuma izni açılır. Kayıtlar bu rolde görünür.`,
);

export default function DialogDemoPage() {
  const [drafts, setDrafts] = useState(DRAFTS);
  const [removing, setRemoving] = useState<string | undefined>();
  const [longOpen, setLongOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [result, setResult] = useState('');

  return (
    <div className="dialog-demo">
      <h2>Taslaklar</h2>
      <ul className="dialog-demo-list" data-testid="drafts">
        {drafts.map((name) => (
          <li key={name}>
            <span>{name}</span>
            <Button data-testid={`remove-${name}`} onClick={() => setRemoving(name)}>
              {`${name} sil`}
            </Button>
          </li>
        ))}
      </ul>
      <Button data-testid="open-long" onClick={() => setLongOpen(true)}>
        Değişiklikleri gözden geçir
      </Button>
      <Button data-testid="open-panel" onClick={() => setPanelOpen(true)}>
        Yan paneli aç
      </Button>
      <ConfirmPopover
        title="Bağlantı kaldırılsın mı?"
        confirmLabel="Bağlantıyı kaldır"
        cancelLabel="Vazgeç"
        onConfirm={() => setResult('Bağlantı kaldırıldı.')}
      >
        <Button data-testid="open-popconfirm">Bağlantıyı kaldır</Button>
      </ConfirmPopover>
      <output data-testid="result">{result}</output>

      <ActionDialog
        open={removing !== undefined}
        title="Taslak silinsin mi?"
        confirmLabel="Taslağı sil"
        cancelLabel="Vazgeç"
        danger
        onConfirm={() => {
          setDrafts((list) => list.filter((name) => name !== removing));
          setRemoving(undefined);
        }}
        onCancel={() => setRemoving(undefined)}
      >
        <p>{removing} kalıcı olarak silinir.</p>
      </ActionDialog>
      <ActionDialog
        open={longOpen}
        title="Değişiklikleri gözden geçirin"
        confirmLabel="Değişiklikleri kaydet"
        cancelLabel="Düzenlemeye devam et"
        onConfirm={() => setLongOpen(false)}
        onCancel={() => setLongOpen(false)}
      >
        <ul>
          {LONG_BODY.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </ActionDialog>
      <SidePanel title="Çalışma alanı" open={panelOpen} onClose={() => setPanelOpen(false)}>
        <p>Panelin içeriği.</p>
      </SidePanel>
    </div>
  );
}
