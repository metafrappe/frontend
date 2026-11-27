import { Alert, Button, Select } from 'antd';
import { Input } from '@/components/controls';
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ApiError } from '@/api';
import type {
  ConnectionCheck,
  ProviderCatalog,
  ProviderDefinition,
  ProviderFieldDefinition,
  SavedConnection,
} from '@/api/provider-client';
import { useModule } from '../context';
import { useRead, type Resource } from '../data';
import { useCopy } from '../messages';
import type { AiConnectionListing } from '../runtime';
import { DateValue, ModuleFrame, ResourceView, Section } from '../shared';
import { useProviderCopy } from './messages';
import {
  NEW_ACCOUNT,
  accountsFor,
  buildConnectionInput,
  checkFailureKey,
  joinConnections,
  saveFailureKey,
  statusKey,
  withoutSecrets,
  type RowStatus,
} from './model';
import './ai-providers.css';

type CheckState =
  | { phase: 'pending' }
  | { phase: 'done'; status: RowStatus; checkedAt: string }
  | { phase: 'error'; key: ReturnType<typeof checkFailureKey> };

type SaveKey = ReturnType<typeof saveFailureKey>;
type SaveCopyKey = Extract<SaveKey, `save${string}`>;
const isSaveCopyKey = (key: SaveKey): key is SaveCopyKey => key.startsWith('save');

/** Frappe tarih saatini (`2026-11-20 09:05:00`) bütün tarayıcıların okuduğu biçime çevirir. */
const isoDateTime = (value: string | null) => (value ? value.replace(' ', 'T') : value);

/** Canlı denemeleri yönetir. Sonuçlar bağlantı adına göre saklanır; liste yenilense de kalır. */
function useChecks() {
  const env = useModule();
  const [checks, setChecks] = useState<Record<string, CheckState>>({});
  const load = env?.client?.aiProviders;
  const run = useCallback(
    async (api: string) => {
      if (!load) return;
      setChecks((current) => ({ ...current, [api]: { phase: 'pending' } }));
      let next: CheckState;
      try {
        const result: ConnectionCheck = await (await load()).checkProviderConnection(api, {});
        next = { phase: 'done', status: result.status, checkedAt: result.checked_at };
      } catch (error) {
        next = { phase: 'error', key: checkFailureKey(error) };
      }
      setChecks((current) => ({ ...current, [api]: next }));
    },
    [load],
  );
  return { checks, run, available: Boolean(load) };
}

function CheckButton({
  state,
  onCheck,
  marker = false,
}: {
  state: CheckState | undefined;
  onCheck: () => void;
  /** Kayıt panelindeki düğme. Panel odağı bu işaretle bulur. */
  marker?: boolean;
}) {
  const p = useProviderCopy();
  const pending = state?.phase === 'pending';
  return (
    <Button
      loading={pending}
      aria-busy={pending}
      onClick={pending ? undefined : onCheck}
      {...(marker ? { 'data-check': '' } : {})}
    >
      {pending ? p.checking : p.check}
    </Button>
  );
}

/** Deneme sonucunun yalın iletisi. "Bağlandı" yanında kota notu durur. */
function CheckResult({ state }: { state: CheckState | undefined }) {
  const p = useProviderCopy();
  const copy = useCopy();
  if (!state || state.phase === 'pending') return null;
  let body: ReactNode;
  if (state.phase === 'error') {
    const message =
      state.key === 'tooFrequent' || state.key === 'checkFailed' ? p[state.key] : copy[state.key];
    body = <Alert type="warning" message={message} />;
  } else if (state.status === 'connected') {
    body = <Alert type="success" message={p.connected} description={p.connectedNote} />;
  } else {
    body = <Alert type="error" message={p[statusKey(state.status)]} />;
  }
  return (
    <div role="status" aria-label={p.resultLabel}>
      {body}
    </div>
  );
}

function ConnectionList({
  listing,
  checks,
  onCheck,
  canCheck,
  resultShownElsewhere,
}: {
  listing: AiConnectionListing;
  checks: Record<string, CheckState>;
  onCheck: (api: string) => void;
  canCheck: boolean;
  /** Bu bağlantının sonucu kayıt panelinde görünür. Liste aynı iletiyi ikinci kez yazmaz. */
  resultShownElsewhere: string | undefined;
}) {
  const p = useProviderCopy();
  const rows = joinConnections(listing.apis, listing.accounts, listing.providers);
  if (rows.length === 0) return <p>{p.noConnections}</p>;
  return (
    <ul className="module-records" aria-label={p.connections}>
      {rows.map((row) => {
        const state = checks[row.name];
        const status = state?.phase === 'done' ? state.status : row.status;
        const checkedAt = state?.phase === 'done' ? state.checkedAt : row.checkedAt;
        return (
          <li key={row.name} className="module-stack ai-provider-row">
            <div className="module-record">
              <div className="module-stack">
                <p className="ai-provider-name">{row.apiName}</p>
                <dl className="ai-provider-facts">
                  <div>
                    <dt>{p.providerColumn}</dt>
                    <dd>{row.provider ?? p.unknownProvider}</dd>
                  </div>
                  <div>
                    <dt>{p.accountColumn}</dt>
                    <dd>{row.account}</dd>
                  </div>
                  <div>
                    <dt>{p.status}</dt>
                    <dd>{p[statusKey(status)]}</dd>
                  </div>
                  <div>
                    <dt>{p.checkedAt}</dt>
                    <dd>
                      {checkedAt ? <DateValue value={isoDateTime(checkedAt)} /> : p.neverChecked}
                    </dd>
                  </div>
                </dl>
              </div>
              {canCheck && <CheckButton state={state} onCheck={() => onCheck(row.name)} />}
            </div>
            {row.name !== resultShownElsewhere && <CheckResult state={state} />}
          </li>
        );
      })}
    </ul>
  );
}

interface FieldProps {
  id: string;
  field: ProviderFieldDefinition;
  value: string;
  invalid: boolean;
  onChange: (value: string) => void;
}

/** Tek bir alanı tanımdaki türe göre çizer. Sır alanı maskelidir ve tarayıcıya kaydedilmez. */
function SchemaField({ id, field, value, invalid, onChange }: FieldProps) {
  const p = useProviderCopy();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const common = {
    id,
    value,
    required: field.required,
    ...(invalid ? { status: 'error' as const } : {}),
    'aria-invalid': invalid || undefined,
    'aria-describedby': invalid ? `${hintId} ${errorId}` : hintId,
    maxLength: 4096,
    onChange: (event: { target: { value: string } }) => onChange(event.target.value),
  };
  return (
    <div className="module-stack ai-provider-field">
      <label htmlFor={id}>
        {field.label}{' '}
        <span className="ai-provider-muted">({field.required ? p.required : p.optional})</span>
      </label>
      {field.kind === 'secret' ? (
        <Input.Password {...common} autoComplete="new-password" spellCheck={false} />
      ) : (
        <Input
          {...common}
          type={field.kind === 'url' ? 'url' : 'text'}
          inputMode={field.kind === 'url' ? 'url' : undefined}
          autoComplete="off"
          spellCheck={false}
        />
      )}
      <p id={hintId} className="ai-provider-muted">
        {field.description}
        {field.kind === 'secret' ? ` ${p.secretNote}` : ''}
      </p>
      {invalid && (
        <p id={errorId} className="ai-provider-error">
          {p.fieldInvalid}
        </p>
      )}
    </div>
  );
}

interface FormProps {
  catalog: ProviderCatalog;
  listing: Resource<AiConnectionListing>;
  onSaved: (saved: SavedConnection, label: string) => void;
  /** Sonuç bilinmiyor ya da çakışma var. Sayfa bağlantı listesini yeniden okur. */
  onUncertain: () => void;
}

/** "API ekle" formu. Alanlar seçilen sağlayıcının tanımından çizilir. */
function ConnectionForm({ catalog, listing, onSaved, onUncertain }: FormProps) {
  const env = useModule();
  const p = useProviderCopy();
  const copy = useCopy();
  const id = useId();
  const [category, setCategory] = useState<string>();
  const [providerId, setProviderId] = useState<string>();
  const [account, setAccount] = useState(NEW_ACCOUNT);
  const [accountName, setAccountName] = useState('');
  const [apiName, setApiName] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [invalid, setInvalid] = useState<ReadonlySet<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<ReactNode>();

  const providers = catalog.providers.filter((item) => item.category === category);
  const provider: ProviderDefinition | undefined = providers.find((item) => item.id === providerId);
  const accounts =
    provider && listing.status === 'ready'
      ? accountsFor(provider.id, listing.data.accounts, listing.data.providers)
      : [];
  const isNew = account === NEW_ACCOUNT;

  const reset = (nextProvider: string | undefined) => {
    setProviderId(nextProvider);
    setAccount(NEW_ACCOUNT);
    setValues({});
    setInvalid(new Set());
    setFailure(undefined);
  };

  const commonValue = (name: string) =>
    name === 'account_name' ? accountName : name === 'api_name' ? apiName : '';
  const setCommon = (name: string, value: string) => {
    if (name === 'account_name') setAccountName(value);
    if (name === 'api_name') setApiName(value);
  };
  const visibleCommon = (provider?.common_fields ?? []).filter(
    (field) => (field.name === 'account_name' && isNew) || field.name === 'api_name',
  );
  const visibleFields = (provider?.fields ?? []).filter(
    (field) => isNew || field.scope !== 'account',
  );

  async function submit() {
    const load = env?.client?.aiProviders;
    if (!provider || !load || saving) return;
    const missing = new Set<string>();
    for (const field of visibleCommon)
      if (field.required && commonValue(field.name).trim() === '') missing.add(field.name);
    for (const field of visibleFields)
      if (field.required && (values[field.name] ?? '').trim() === '') missing.add(field.name);
    setInvalid(missing);
    if (missing.size > 0) {
      setFailure(p.formInvalid);
      return;
    }
    setSaving(true);
    setFailure(undefined);
    let providers;
    try {
      providers = await load();
    } catch {
      // İstek hiç gitmedi. Sonuç belirsiz değildir.
      setFailure(p.loadFailed);
      setSaving(false);
      return;
    }
    try {
      const saved = await providers.saveProviderConnection(
        buildConnectionInput(provider, { account, accountName, apiName, values }),
        {},
      );
      // Sır bu noktadan sonra durumda tutulmaz.
      setValues({});
      onSaved(saved, apiName.trim());
    } catch (error) {
      if (error instanceof ApiError && error.fields && error.fields.length > 0) {
        setInvalid(new Set(error.fields));
        setFailure(p.formInvalid);
      } else {
        const key = saveFailureKey(error);
        setFailure(isSaveCopyKey(key) ? p[key] : copy[key]);
        // Sonuç belirsizse kayıt yazılmış olabilir. Sır formda kalmaz.
        // Sır alanı zorunludur. Yönetici sırrı yeniden yazmadan ikinci kayıt isteği gitmez.
        if (key === 'saveUncertain') setValues((current) => withoutSecrets(current, provider));
        if (key === 'saveUncertain' || key === 'saveConflict') onUncertain();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="module-stack ai-provider-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="module-stack ai-provider-field">
        <label htmlFor={`${id}-category`}>{p.category}</label>
        <Select<string>
          id={`${id}-category`}
          value={category ?? null}
          placeholder={p.categoryPlaceholder}
          onChange={(value) => {
            setCategory(value);
            reset(undefined);
          }}
          options={catalog.categories.map((item) => ({ value: item.id, label: item.label }))}
        />
      </div>
      {category && (
        <div className="module-stack ai-provider-field">
          <label htmlFor={`${id}-provider`}>{p.provider}</label>
          <Select<string>
            id={`${id}-provider`}
            value={providerId ?? null}
            placeholder={p.providerPlaceholder}
            onChange={reset}
            options={providers.map((item) => ({ value: item.id, label: item.label }))}
          />
          {provider && <p className="ai-provider-muted">{provider.description}</p>}
        </div>
      )}
      {provider && (
        <>
          <div className="module-stack ai-provider-field">
            <label htmlFor={`${id}-account`}>{p.account}</label>
            <Select<string>
              id={`${id}-account`}
              value={account}
              {...(invalid.has('account')
                ? {
                    status: 'error' as const,
                    'aria-invalid': true,
                    'aria-describedby': `${id}-account-error`,
                  }
                : {})}
              onChange={(value) => {
                setAccount(value);
                setInvalid(new Set());
              }}
              options={[
                { value: NEW_ACCOUNT, label: p.newAccount },
                ...accounts.map((item) => ({ value: item.name, label: item.label })),
              ]}
            />
            {invalid.has('account') && (
              <p id={`${id}-account-error`} className="ai-provider-error">
                {p.fieldInvalid}
              </p>
            )}
            {!isNew && <p className="ai-provider-muted">{p.existingAccountNote}</p>}
          </div>
          {visibleCommon.map((field) => (
            <SchemaField
              key={field.name}
              id={`${id}-common-${field.name}`}
              field={field}
              value={commonValue(field.name)}
              invalid={invalid.has(field.name)}
              onChange={(value) => setCommon(field.name, value)}
            />
          ))}
          {visibleFields.map((field) => (
            <SchemaField
              key={field.name}
              id={`${id}-field-${field.name}`}
              field={field}
              value={values[field.name] ?? ''}
              invalid={invalid.has(field.name) || invalid.has('fields')}
              onChange={(value) => setValues((current) => ({ ...current, [field.name]: value }))}
            />
          ))}
          {failure && <Alert role="alert" type="error" message={failure} />}
          <div className="module-actions">
            <Button htmlType="submit" type="primary" loading={saving} aria-busy={saving}>
              {saving ? p.saving : p.save}
            </Button>
          </div>
        </>
      )}
    </form>
  );
}

/** Kaydedilen bağlantının özeti. Sır burada yoktur. "Bağlantıyı dene" ayrı adımdır. */
export function SavedPanel({
  label,
  state,
  onCheck,
  canCheck,
}: {
  label: string;
  state: CheckState | undefined;
  onCheck: () => void;
  canCheck: boolean;
}) {
  const p = useProviderCopy();
  const panel = useRef<HTMLDivElement>(null);
  // Form kalkınca odak boşa düşmesin: odak "Bağlantıyı dene" düğmesine, düğme yoksa panele gider.
  // Bu programatik bir odak taşımasıdır; klavye modu açıksa görünür gösterge korunur.
  useEffect(() => {
    const target = panel.current?.querySelector<HTMLElement>('[data-check]') ?? panel.current;
    target?.focus();
  }, []);
  return (
    <div className="module-stack" ref={panel} tabIndex={-1}>
      <Alert type="info" message={p.saved} description={label} />
      {canCheck && (
        <div className="module-actions">
          <CheckButton state={state} onCheck={onCheck} marker />
        </div>
      )}
      <CheckResult state={state} />
    </div>
  );
}

export default function AiProvidersPage() {
  const env = useModule();
  const p = useProviderCopy();
  // Sağlayıcı istemcisi ayrı parçadadır. İlk okuma onu yükler; tarayıcı parçayı bir kez indirir.
  const load = env?.client?.aiProviders;
  // Uç yoksa `useRead` yükleyiciyi hiç çağırmaz; ret yalnız tip için vardır.
  const client = useCallback(
    () => (load ? load() : Promise.reject(new Error('unavailable'))),
    [load],
  );
  const loadCatalog = useCallback(
    async (signal: AbortSignal) => (await client()).listProviderCatalog({ signal }),
    [client],
  );
  const loadConnections = useCallback(
    async (signal: AbortSignal) => (await client()).listAiConnections({ signal }),
    [client],
  );
  const catalog = useRead(load ? loadCatalog : null, 'catalog');
  const connections = useRead(load ? loadConnections : null, 'connections');
  const { checks, run, available } = useChecks();
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<{ api: string; label: string }>();
  const [formKey, setFormKey] = useState(0);
  // Form kapanınca odak "API ekle" düğmesine döner (programatik dönüş odağı).
  const returnFocus = useRef(false);
  const focusAdd = useCallback((node: HTMLButtonElement | null) => {
    if (node && returnFocus.current) {
      returnFocus.current = false;
      node.focus();
    }
  }, []);

  const closeForm = () => {
    returnFocus.current = true;
    setOpen(false);
    setSaved(undefined);
    setFormKey((value) => value + 1);
  };

  let adder: ReactNode;
  if (catalog.state.status === 'error' && catalog.state.error === 'forbidden') {
    adder = <Alert type="info" message={p.catalogForbidden} />;
  } else {
    adder = (
      <ResourceView state={catalog.state} retry={catalog.refresh}>
        {(data) =>
          !open ? (
            <div className="module-actions">
              <Button type="primary" ref={focusAdd} onClick={() => setOpen(true)}>
                {p.add}
              </Button>
            </div>
          ) : (
            <Section title={p.formTitle}>
              {saved ? (
                <SavedPanel
                  label={saved.label}
                  state={checks[saved.api]}
                  canCheck={available}
                  onCheck={() => void run(saved.api)}
                />
              ) : (
                <ConnectionForm
                  key={formKey}
                  catalog={data}
                  listing={connections.state}
                  onSaved={(result, label) => {
                    setSaved({ api: result.api, label });
                    connections.refresh();
                  }}
                  onUncertain={connections.refresh}
                />
              )}
              <div className="module-actions">
                <Button onClick={closeForm}>{p.closeForm}</Button>
              </div>
            </Section>
          )
        }
      </ResourceView>
    );
  }

  return (
    <ModuleFrame title={p.title}>
      <p>{p.intro}</p>
      {adder}
      <Section title={p.connections}>
        <ResourceView state={connections.state} retry={connections.refresh}>
          {(listing) => (
            <ConnectionList
              listing={listing}
              checks={checks}
              canCheck={available}
              onCheck={(api) => void run(api)}
              resultShownElsewhere={open ? saved?.api : undefined}
            />
          )}
        </ResourceView>
      </Section>
    </ModuleFrame>
  );
}
