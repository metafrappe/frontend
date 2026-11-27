/**
 * Billing details page (AJA-1785, AJA-1733): billing address by billing country, the tax number
 * status and the terms acceptance. Rules are in `model.ts`. Texts are in `messages.ts`.
 */
import { Alert } from 'antd';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { Button, Checkbox, Input, Radio, Select } from '@/components/controls';

import { useModule } from '../context';
import { ModuleFrame, Section } from '../shared';
import { useBillingCopy } from './messages';
import {
  BILLING_COUNTRIES,
  TERMS_ID,
  acceptanceInput,
  addressFormat,
  buildBillingInput,
  validateDraft,
  type AddressField,
  type BillingClient,
  type BillingDraft,
  type DraftField,
  type FieldErrorKey,
  type SavedBilling,
  type TermsAcceptance,
  type TermsText,
} from './model';
import './billing.css';

const EMPTY_DRAFT: BillingDraft = { kind: 'person', name: '', taxId: '', country: '', address: {} };

/** Loads the billing client once. The client code is not part of the first load. */
function useBillingClient(): BillingClient | null | undefined {
  const load = useModule()?.client?.billing;
  const [client, setClient] = useState<BillingClient | null | undefined>(load ? undefined : null);
  useEffect(() => {
    if (!load) return;
    let live = true;
    load().then(
      (loaded) => live && setClient(loaded),
      () => live && setClient(null),
    );
    return () => {
      live = false;
    };
  }, [load]);
  return client;
}

interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  required: boolean;
  error: FieldErrorKey | undefined;
  hint?: string;
  onChange: (value: string) => void;
  autoComplete?: string;
}

function TextField({
  id,
  label,
  value,
  required,
  error,
  hint,
  onChange,
  autoComplete,
}: TextFieldProps) {
  const copy = useBillingCopy();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : '', error ? errorId : ''].filter(Boolean).join(' ');
  return (
    <div className="module-stack billing-field">
      <label htmlFor={id}>{label}</label>
      <Input
        id={id}
        value={value}
        autoComplete={autoComplete ?? 'off'}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...(error ? { status: 'error' as const } : {})}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint && (
        <p id={hintId} className="billing-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="billing-error">
          {copy.errors[error]}
        </p>
      )}
    </div>
  );
}

type SaveState =
  | { phase: 'idle' }
  | { phase: 'saving' }
  | { phase: 'saved'; result: SavedBilling; name: string }
  | { phase: 'failed' };

function BillingForm({ client }: { client: BillingClient }) {
  const copy = useBillingCopy();
  const id = useId();
  const [draft, setDraft] = useState<BillingDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<Partial<Record<DraftField, FieldErrorKey>>>({});
  const [save, setSave] = useState<SaveState>({ phase: 'idle' });
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  const format = draft.country ? addressFormat(draft.country) : null;
  const setAddress = (field: AddressField, value: string) =>
    setDraft((current) => ({ ...current, address: { ...current.address, [field]: value } }));

  const submit = async () => {
    if (save.phase === 'saving') return;
    const found = validateDraft(draft);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setSave({ phase: 'idle' });
      return;
    }
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setSave({ phase: 'saving' });
    try {
      const result = await client.saveBillingDraft(buildBillingInput(draft), {
        signal: controller.signal,
      });
      if (!controller.signal.aborted) setSave({ phase: 'saved', result, name: draft.name.trim() });
    } catch {
      // The draft stays in the form. Nothing is cleared.
      if (!controller.signal.aborted) setSave({ phase: 'failed' });
    }
  };

  const tax = save.phase === 'saved' ? save.result.tax_id_check?.result : undefined;
  return (
    <Section title={copy.billingSection}>
      <form
        className="module-stack billing-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <fieldset className="module-stack billing-field">
          <legend>{copy.partyKind}</legend>
          <Radio.Group
            value={draft.kind}
            onChange={(event) => setDraft((current) => ({ ...current, kind: event.target.value }))}
          >
            <Radio value="person">{copy.kinds.person}</Radio>
            <Radio value="company">{copy.kinds.company}</Radio>
          </Radio.Group>
        </fieldset>
        <TextField
          id={`${id}-name`}
          label={copy.name}
          hint={copy.nameHelp}
          value={draft.name}
          required
          error={errors.name}
          autoComplete={draft.kind === 'company' ? 'organization' : 'name'}
          onChange={(name) => setDraft((current) => ({ ...current, name }))}
        />
        <TextField
          id={`${id}-tax`}
          label={copy.taxId}
          value={draft.taxId}
          required={false}
          error={undefined}
          onChange={(taxId) => setDraft((current) => ({ ...current, taxId }))}
        />
        <div className="module-stack billing-field">
          <label htmlFor={`${id}-country`}>{copy.country}</label>
          <Select<string>
            id={`${id}-country`}
            value={draft.country || null}
            placeholder={copy.countryPlaceholder}
            options={BILLING_COUNTRIES.map((code) => ({
              value: code,
              label: copy.countries[code],
            }))}
            aria-required
            {...(errors.country
              ? {
                  status: 'error' as const,
                  'aria-invalid': true,
                  'aria-describedby': `${id}-country-error`,
                }
              : {})}
            onChange={(country) => {
              setDraft((current) => ({ ...current, country }));
              // Errors of the old format no longer apply.
              setErrors((current) => (current.name ? { name: current.name } : {}));
            }}
          />
          {errors.country && (
            <p id={`${id}-country-error`} className="billing-error">
              {copy.errors[errors.country]}
            </p>
          )}
        </div>
        {format?.fields.map((field) => (
          <TextField
            key={`${draft.country === 'TR' ? 'TR' : 'default'}-${field}`}
            id={`${id}-${field}`}
            label={copy.fields[field]}
            value={draft.address[field] ?? ''}
            required={format.required.includes(field)}
            error={errors[field]}
            onChange={(value) => setAddress(field, value)}
          />
        ))}
        <div className="module-actions">
          <Button
            type="primary"
            htmlType="submit"
            loading={save.phase === 'saving'}
            aria-busy={save.phase === 'saving' || undefined}
          >
            {save.phase === 'saving' ? copy.saving : copy.save}
          </Button>
        </div>
        {save.phase === 'failed' && <Alert role="alert" type="error" message={copy.saveFailed} />}
        {save.phase === 'saved' && (
          <div className="module-stack">
            {tax === 'invalid' ? (
              <Alert role="alert" type="error" message={copy.tax.invalid} />
            ) : tax === 'unavailable' ? (
              // Not an error: nothing is known about the number. The draft was saved.
              <Alert role="status" type="warning" message={copy.tax.unavailable} />
            ) : (
              <Alert
                role="status"
                type="success"
                message={tax === 'valid' ? `${copy.saved} ${copy.tax.valid}` : copy.saved}
              />
            )}
            <dl className="billing-summary">
              <div>
                <dt>{copy.savedSummary}</dt>
                <dd>{save.name}</dd>
              </div>
            </dl>
          </div>
        )}
      </form>
    </Section>
  );
}

type TermsState = { phase: 'loading' } | { phase: 'ready'; text: TermsText } | { phase: 'failed' };

type AcceptState =
  | { phase: 'idle' }
  | { phase: 'sending' }
  | { phase: 'done'; record: TermsAcceptance }
  | { phase: 'failed' };

function TermsPanel({ client }: { client: BillingClient }) {
  const copy = useBillingCopy();
  const locale = useModule()?.locale ?? 'en';
  const id = useId();
  const [attempt, setAttempt] = useState(0);
  const request = `${locale}:${attempt}`;
  // The loaded text belongs to one language. A new language hides the old text at once,
  // so the old text can no longer be accepted.
  const [loaded, setLoaded] = useState<{ request: string; state: TermsState }>({
    request: '',
    state: { phase: 'loading' },
  });
  const terms: TermsState = loaded.request === request ? loaded.state : { phase: 'loading' };
  // The tick belongs to the text it was given for. A new text needs a new tick.
  const [agreedTo, setAgreedTo] = useState<string | null>(null);
  const shownKey =
    terms.phase === 'ready' ? `${terms.text.locale}:${terms.text.terms_version}` : null;
  const agreed = shownKey !== null && agreedTo === shownKey;
  const [accept, setAccept] = useState<AcceptState>({ phase: 'idle' });

  useEffect(() => {
    const controller = new AbortController();
    client.getTerms(TERMS_ID, locale, { signal: controller.signal }).then(
      (text) =>
        !controller.signal.aborted && setLoaded({ request, state: { phase: 'ready', text } }),
      () => !controller.signal.aborted && setLoaded({ request, state: { phase: 'failed' } }),
    );
    return () => controller.abort();
  }, [client, locale, request]);

  const send = useCallback(
    async (shown: TermsText) => {
      setAccept({ phase: 'sending' });
      try {
        const record = await client.acceptTerms(acceptanceInput(shown), {});
        setAccept({ phase: 'done', record });
      } catch {
        setAccept({ phase: 'failed' });
      }
    },
    [client],
  );

  return (
    <Section title={copy.termsSection}>
      {terms.phase === 'loading' && <p role="status">{copy.termsLoading}</p>}
      {terms.phase === 'failed' && (
        <div className="module-stack">
          <Alert role="alert" type="error" message={copy.termsFailed} />
          <div className="module-actions">
            <Button onClick={() => setAttempt((count) => count + 1)}>{copy.retry}</Button>
          </div>
        </div>
      )}
      {terms.phase === 'ready' && (
        <div className="module-stack billing-terms" lang={terms.text.locale}>
          <h3>{terms.text.title}</h3>
          <dl className="billing-summary">
            <div>
              <dt>{copy.version}</dt>
              <dd>{terms.text.terms_version}</dd>
            </div>
            <div>
              <dt>{copy.language}</dt>
              <dd>{copy.languages[terms.text.locale]}</dd>
            </div>
          </dl>
          <p className="billing-terms-body">{terms.text.body}</p>
          {accept.phase === 'done' ? (
            <Alert
              role="status"
              type="success"
              message={copy.accepted(
                accept.record.terms_version,
                copy.languages[accept.record.shown_locale === 'tr' ? 'tr' : 'en'],
              )}
            />
          ) : (
            <>
              <Checkbox
                id={`${id}-agree`}
                checked={agreed}
                onChange={(event) => setAgreedTo(event.target.checked ? shownKey : null)}
              >
                {copy.agree}
              </Checkbox>
              <div className="module-actions">
                <Button
                  type="primary"
                  disabled={!agreed}
                  loading={accept.phase === 'sending'}
                  onClick={accept.phase === 'sending' ? undefined : () => void send(terms.text)}
                >
                  {accept.phase === 'sending' ? copy.accepting : copy.accept}
                </Button>
              </div>
              {accept.phase === 'failed' && (
                <Alert role="alert" type="error" message={copy.acceptFailed} />
              )}
            </>
          )}
        </div>
      )}
    </Section>
  );
}

export default function BillingPage() {
  const copy = useBillingCopy();
  const client = useBillingClient();
  return (
    <ModuleFrame title={copy.title}>
      <div className="module-stack billing-page">
        <p>{copy.intro}</p>
        {client === undefined && <p role="status">{copy.termsLoading}</p>}
        {client && (
          <>
            <BillingForm client={client} />
            <TermsPanel client={client} />
          </>
        )}
      </div>
    </ModuleFrame>
  );
}
