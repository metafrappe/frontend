/**
 * Billing deneme sayfası (AJA-1785). Yalnız e2e derlemesinde `/_demo/billing` yolunda açılır.
 * Sahte istemci istekleri `window.__billingRequests` listesine yazar. Test bu listeyi okur.
 * `?tax=unavailable` vergi servisinin kapalı olduğu durumu gösterir.
 */
import { useMemo, useState } from 'react';

import { Button } from '@/components/controls';

import { ModuleProvider } from '../../runtime';
import type { BillingClient, TaxIdResult, TermsLocale, TermsText } from '../model';
import BillingPage from '../Page';

/** Sample terms. The version is the same in both languages. */
function sampleTerms(shown: TermsLocale, title: string, body: string): TermsText {
  return { terms_id: 'terms-of-use', terms_version: '2026-11-01', locale: shown, title, body };
}

const TERMS: Record<TermsLocale, TermsText> = {
  en: sampleTerms('en', 'Terms of use', 'You use the service under these terms.'),
  tr: sampleTerms('tr', 'Kullanım koşulları', 'Hizmeti bu koşullarla kullanırsınız.'),
};

interface Recorded {
  method: string;
  body: unknown;
}
declare global {
  interface Window {
    __billingRequests?: Recorded[];
  }
}

function record(method: string, body: unknown) {
  window.__billingRequests ??= [];
  window.__billingRequests.push({ method, body });
}

function fakeClient(tax: TaxIdResult): BillingClient {
  return {
    saveBillingDraft: async (input) => {
      record('saveBillingDraft', input);
      return {
        tax_id_check: input.party.tax_id
          ? {
              result: tax,
              checked_at: '2026-11-27T09:30:00Z',
              billing_country: input.billing_address.billing_country,
            }
          : null,
      };
    },
    getTerms: async (_id, locale) => TERMS[locale],
    acceptTerms: async (input) => {
      record('acceptTerms', input);
      return {
        acceptance_id: 'acc-0001',
        ...input,
        user: 'example-sub',
        accepted_at: '2026-11-27T09:30:00Z',
      };
    },
  };
}

export default function BillingDemoPage() {
  const [locale, setLocale] = useState<TermsLocale>('tr');
  const client = useMemo(() => {
    const tax = new URLSearchParams(window.location.search).get('tax');
    const result: TaxIdResult = tax === 'invalid' || tax === 'unavailable' ? tax : 'valid';
    const billing = fakeClient(result);
    return { billing: () => Promise.resolve(billing) };
  }, []);
  return (
    <div lang={locale}>
      <div className="module-actions" style={{ padding: 'var(--space-md)' }}>
        <Button aria-pressed={locale === 'tr'} onClick={() => setLocale('tr')} lang="tr">
          Türkçe
        </Button>
        <Button aria-pressed={locale === 'en'} onClick={() => setLocale('en')} lang="en">
          English
        </Button>
      </div>
      <ModuleProvider
        value={{ tenant: 'example-site', user: 'example-user', mode: 'example', locale, client }}
      >
        <BillingPage />
      </ModuleProvider>
    </div>
  );
}
