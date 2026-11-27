/**
 * İş anahtarı deneme sayfası. Yalnız e2e derlemesinde `/_demo/idempotency` yolunda açılır.
 * Rota satırı `src/shell/routes.ts` içindedir. Sunucu sahtedir; ağ isteği gitmez.
 */
import { Button } from 'antd';
import { useMemo, useRef, useState } from 'react';

import { ApiError, createIdempotentRunner, createKeyStore, idempotencyKeyName } from '@/api';

import { IdempotentAction } from '../idempotent-action';
import { useLatestRecord } from '../latest-record';
import { ModuleProvider } from '../runtime';
import { ModuleFrame, Section } from '../shared';

interface Ticket {
  name: string;
  subject: string;
  version: string;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const team = 'example-site';

function Demo() {
  const runner = useMemo(() => createIdempotentRunner({ store: createKeyStore() }), []);
  // Gönderilen istek sayısı. Sayaç düz bir değişkendir; React güncelleme işlevini yeniden çalıştırabilir.
  const sent = useRef(0);
  const [requests, setRequests] = useState(0);
  const count = () => {
    sent.current += 1;
    setRequests(sent.current);
  };
  const [serverVersion, setServerVersion] = useState('2026-11-27 10:00:00.000001');
  const [ticket, accept] = useLatestRecord<Ticket>(
    { name: 'TICKET-1', subject: 'Yazıcı açılmıyor', version: '2026-11-27 10:00:00.000001' },
    (t) => t.version,
  );

  const create = async (key: string) => {
    count();
    await wait(800);
    return { name: 'TICKET-2', key };
  };
  const save = async () => {
    count();
    await wait(800);
    if (ticket.version !== serverVersion) {
      throw new ApiError({ kind: 'conflict', status: 409, code: 'VersionConflictError' });
    }
    const version = '2026-11-27 10:00:00.000002';
    setServerVersion(version);
    return { ...ticket, subject: 'Güncellemeden sonra yazıcı açılmıyor', version };
  };

  return (
    <ModuleFrame title="Destek kaydı">
      <Section title="Destek kaydı açın">
        <IdempotentAction
          name={idempotencyKeyName(team, 'support-create', 'new')}
          label="Kayıt aç"
          runner={runner}
          send={create}
        />
      </Section>
      <Section title="Destek kaydını düzenleyin">
        <p data-testid="ticket-subject">{ticket.subject}</p>
        <IdempotentAction
          name={idempotencyKeyName(team, 'support-update', ticket.name)}
          label="Kaydet"
          runner={runner}
          send={save}
          onDone={accept}
        />
        <Button onClick={() => setServerVersion('2026-11-27 10:00:00.000009')}>
          Başka sekmede değiştir
        </Button>
      </Section>
      <p data-testid="request-count">Gönderilen istek: {requests}</p>
    </ModuleFrame>
  );
}

export default function IdempotencyDemoPage() {
  return (
    <ModuleProvider value={{ tenant: team, user: 'example-user', mode: 'example' }}>
      <Demo />
    </ModuleProvider>
  );
}
