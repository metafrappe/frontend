// "Müşteriler" sayfası (G-169, G-170). Bayinin bağlı müşterilerini ve site durumlarını gösterir.
// "Reseller Admin" yeni müşteri isteği gönderir. "Reseller Assistant" sayfayı yalnız okur.
// Menü ve sayfa kapısı bu sayfayı kiracı hesabına açmaz. Yetkiyi sunucu yine denetler.
import { Alert, Button } from 'antd';
import { Input } from '@/components/controls';
import { useCallback, useId, useState } from 'react';

import type { CustomerStatus, ResellerCustomer } from '../../api';
import { canRequestCustomer, isReadOnly, useRoles } from '../access';
import { useModule } from '../context';
import { useMutation, useRead } from '../data';
import { useCopy } from '../messages';
import type { ResellerClient } from '../runtime';
import { ModuleFrame, ResourceView, Section } from '../shared';

interface CustomerRow extends ResellerCustomer {
  /** Durum okunamazsa `null` olur. Satır yine görünür. */
  status: CustomerStatus['status'] | null;
}

/** Aynı anda en çok bu kadar durum isteği gider. Sunucunun hız sınırını korur. */
const STATUS_BATCH = 5;

async function loadRows(client: ResellerClient, signal: AbortSignal): Promise<CustomerRow[]> {
  const customers = await client.listCustomers({ signal });
  const rows: CustomerRow[] = [];
  for (let i = 0; i < customers.length; i += STATUS_BATCH) {
    const batch = customers.slice(i, i + STATUS_BATCH);
    const statuses = await Promise.allSettled(
      batch.map((c) => client.customerStatus(c.customer_tenant, { signal })),
    );
    batch.forEach((c, index) => {
      const result = statuses[index];
      rows.push({ ...c, status: result?.status === 'fulfilled' ? result.value.status : null });
    });
  }
  return rows;
}

type Copy = ReturnType<typeof useCopy>;

function statusLabel(copy: Copy, status: string | null): string {
  if (status === null) return copy.statusUnknown;
  const key = `status_${status}` as keyof Copy;
  return Object.prototype.hasOwnProperty.call(copy, key) ? copy[key] : status;
}

function RequestForm({ client }: { client: ResellerClient }) {
  const copy = useCopy();
  const id = useId();
  const action = useMutation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState<string>();
  if (sent) {
    return <Alert type="success" role="status" message={`${copy.requestSent} ${sent}`} />;
  }
  const ready = name.trim().length > 0 && email.trim().length > 0;
  return (
    <form
      className="module-stack module-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!ready) return;
        void action
          .run((signal) =>
            client.requestCustomer(
              { customer_name: name.trim(), contact_email: email.trim() },
              { signal },
            ),
          )
          .then((result) => result && setSent(result.name));
      }}
    >
      <p>{copy.requestNote}</p>
      <label htmlFor={`${id}-name`}>{copy.customerName}</label>
      <Input
        id={`${id}-name`}
        required
        maxLength={140}
        autoComplete="organization"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <label htmlFor={`${id}-email`}>{copy.contactEmail}</label>
      <Input
        id={`${id}-email`}
        type="email"
        required
        maxLength={140}
        autoComplete="email"
        inputMode="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      {action.state.status === 'error' && (
        <Alert role="alert" type="error" message={copy[action.state.error]} />
      )}
      <Button
        htmlType="submit"
        type="primary"
        disabled={!ready}
        loading={action.state.status === 'pending'}
      >
        {copy.sendRequest}
      </Button>
    </form>
  );
}

export default function CustomersPage() {
  const env = useModule();
  const copy = useCopy();
  const roles = useRoles();
  const [client, setClient] = useState<ResellerClient>();
  const [requesting, setRequesting] = useState(false);
  const loadClient = env?.client?.resellers;
  const load = useCallback(
    async (signal: AbortSignal) => {
      if (!loadClient) throw new Error('unavailable');
      const reseller = await loadClient();
      setClient(reseller);
      return loadRows(reseller, signal);
    },
    [loadClient],
  );
  const read = useRead(loadClient ? load : null, 'customers');
  const readOnly = isReadOnly(roles);
  const canRequest = canRequestCustomer(roles) && !readOnly;
  return (
    <ModuleFrame title={copy.customers}>
      {readOnly && <Alert type="info" message={copy.readOnlySection} />}
      {canRequest && client && (
        <Section title={copy.newCustomerRequest}>
          {requesting ? (
            <RequestForm client={client} />
          ) : (
            <div className="module-actions">
              <Button type="primary" onClick={() => setRequesting(true)}>
                {copy.newCustomerRequest}
              </Button>
            </div>
          )}
        </Section>
      )}
      <Section title={copy.customerList}>
        <ResourceView state={read.state} retry={read.refresh}>
          {(rows) =>
            rows.length === 0 ? (
              <p>{copy.noCustomers}</p>
            ) : (
              <ul className="module-records">
                {rows.map((row) => (
                  <li key={row.customer_tenant}>
                    <dl>
                      <dt>{copy.customerTenant}</dt>
                      <dd>{row.customer_tenant}</dd>
                      <dt>{copy.siteStatus}</dt>
                      <dd>{statusLabel(copy, row.status)}</dd>
                    </dl>
                  </li>
                ))}
              </ul>
            )
          }
        </ResourceView>
      </Section>
    </ModuleFrame>
  );
}
