// Billing form, tax number status and terms acceptance (AJA-1785, AJA-1733).
// Contract: metafrappe/backend `contracts/billing_identity.schema.json` and
// `contracts/terms_acceptance.schema.json` (AJA-1776).
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModuleProvider, type ModuleEnvironment } from '../runtime';
import type { BillingClient, TermsText } from './model';
import BillingPage from './Page';

afterEach(cleanup);

const terms: Record<'en' | 'tr', TermsText> = {
  en: {
    terms_id: 'terms-of-use',
    terms_version: '2026-11-01',
    locale: 'en',
    title: 'Terms of use',
    body: 'You use the service under these terms.',
  },
  tr: {
    terms_id: 'terms-of-use',
    terms_version: '2026-11-01',
    locale: 'tr',
    title: 'Kullanım koşulları',
    body: 'Hizmeti bu koşullarla kullanırsınız.',
  },
};

function fakeClient(overrides: Partial<BillingClient> = {}): BillingClient {
  return {
    saveBillingDraft: vi.fn().mockResolvedValue({ tax_id_check: null }),
    getTerms: vi.fn((_id: string, locale: 'en' | 'tr') => Promise.resolve(terms[locale])),
    acceptTerms: vi.fn().mockImplementation((body) =>
      Promise.resolve({
        acceptance_id: 'acc-0001',
        ...body,
        user: 'example-sub',
        accepted_at: '2026-11-27T09:30:00Z',
      }),
    ),
    ...overrides,
  };
}

function env(billing: BillingClient, locale: 'en' | 'tr'): ModuleEnvironment {
  return {
    tenant: 'example-site',
    user: 'example-user',
    mode: 'example',
    locale,
    client: { billing: () => Promise.resolve(billing) },
  };
}

function renderPage(billing: BillingClient, locale: 'en' | 'tr' = 'tr') {
  const view = render(
    <ModuleProvider value={env(billing, locale)}>
      <BillingPage />
    </ModuleProvider>,
  );
  return {
    ...view,
    setLocale: (next: 'en' | 'tr') =>
      view.rerender(
        <ModuleProvider value={env(billing, next)}>
          <BillingPage />
        </ModuleProvider>,
      ),
  };
}

/** Picks an option of the branded Select without a keyboard. */
async function choose(label: string, option: string) {
  fireEvent.mouseDown(await screen.findByLabelText(label));
  const items = await screen.findAllByText(option, {
    selector: '.ant-select-item-option-content',
  });
  fireEvent.click(items[items.length - 1]!);
}

function type(label: string | RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe('billing address follows the billing country', () => {
  it('Türkiye: il alanı görünür ve zorunludur, başka ülkede il alanı zorunlu değildir', async () => {
    const billing = fakeClient();
    // The screen language is English. The Turkish format still asks for a province.
    renderPage(billing, 'en');
    await choose('Billing country', 'Türkiye');
    const province = await screen.findByLabelText(/^Province/);
    expect(province).toHaveAttribute('aria-required', 'true');

    type(/^Name or company title/, 'Madonna');
    type(/^Street address/, 'Örnek Sokak 1');
    type(/^District/, 'Kadıköy');
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText('Enter the province.')).toBeInTheDocument();
    expect(billing.saveBillingDraft).not.toHaveBeenCalled();

    await choose('Billing country', 'United Kingdom');
    expect(screen.queryByLabelText(/^Province/)).not.toBeInTheDocument();
    type(/^City/, 'London');
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(billing.saveBillingDraft).toHaveBeenCalledTimes(1));
    const [body] = vi.mocked(billing.saveBillingDraft).mock.calls[0]!;
    expect(body.billing_address).toMatchObject({ billing_country: 'GB', city: 'London' });
    expect(body.billing_address).not.toHaveProperty('province');
  });

  it('tek parçalı ad formu durdurmaz', async () => {
    const billing = fakeClient();
    renderPage(billing, 'tr');
    await choose('Fatura ülkesi', 'Türkiye');
    type(/^Ad ya da şirket unvanı/, 'Madonna');
    type(/^Adres$/, 'Örnek Sokak 1');
    type(/^İlçe/, 'Kadıköy');
    type(/^İl/, 'İstanbul');
    fireEvent.click(screen.getByRole('button', { name: 'Taslağı kaydet' }));
    await waitFor(() => expect(billing.saveBillingDraft).toHaveBeenCalledTimes(1));
    const [body] = vi.mocked(billing.saveBillingDraft).mock.calls[0]!;
    expect(body.party).toMatchObject({ kind: 'person', name: 'Madonna' });
    expect(await screen.findByText('Taslak kaydedildi.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('tax number status', () => {
  it('vergi servisi kapalıyken "numara yanlış" demez ve taslağı korur', async () => {
    const billing = fakeClient({
      saveBillingDraft: vi.fn().mockResolvedValue({
        tax_id_check: {
          result: 'unavailable',
          checked_at: '2026-11-27T09:30:00Z',
          billing_country: 'TR',
        },
      }),
    });
    renderPage(billing, 'tr');
    await choose('Fatura ülkesi', 'Türkiye');
    type(/^Ad ya da şirket unvanı/, 'Örnek Anonim Şirketi');
    type(/^Vergi numarası/, '1234567890');
    type(/^Adres$/, 'Örnek Sokak 1');
    type(/^İlçe/, 'Kadıköy');
    type(/^İl/, 'İstanbul');
    fireEvent.click(screen.getByRole('button', { name: 'Taslağı kaydet' }));

    expect(await screen.findByText(/şu an denetlenemedi/)).toBeInTheDocument();
    expect(screen.queryByText(/yanlış/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^Vergi numarası/)).toHaveValue('1234567890');
    expect(screen.getByLabelText(/^Ad ya da şirket unvanı/)).toHaveValue('Örnek Anonim Şirketi');
    expect(screen.getByLabelText(/^İl/)).toHaveValue('İstanbul');
  });

  it('servis numarayı reddederse numaranın yanlış olduğunu söyler', async () => {
    const billing = fakeClient({
      saveBillingDraft: vi.fn().mockResolvedValue({
        tax_id_check: { result: 'invalid', checked_at: '2026-11-27T09:30:00Z' },
      }),
    });
    renderPage(billing, 'tr');
    await choose('Fatura ülkesi', 'Türkiye');
    type(/^Ad ya da şirket unvanı/, 'Madonna');
    type(/^Vergi numarası/, '1');
    type(/^Adres$/, 'Örnek Sokak 1');
    type(/^İlçe/, 'Kadıköy');
    type(/^İl/, 'İstanbul');
    fireEvent.click(screen.getByRole('button', { name: 'Taslağı kaydet' }));
    expect(await screen.findByText(/Vergi numarası yanlış/)).toBeInTheDocument();
    expect(screen.queryByText(/denetlenemedi/)).not.toBeInTheDocument();
  });
});

describe('terms acceptance', () => {
  it('dil kayıt sırasında değişince istek gösterilen metnin dilini ve sürümünü taşır', async () => {
    const billing = fakeClient();
    const view = renderPage(billing, 'tr');
    expect(await screen.findByText('Hizmeti bu koşullarla kullanırsınız.')).toBeInTheDocument();

    act(() => view.setLocale('en'));
    expect(await screen.findByText('You use the service under these terms.')).toBeInTheDocument();
    expect(billing.getTerms).toHaveBeenLastCalledWith('terms-of-use', 'en', expect.anything());

    fireEvent.click(screen.getByRole('checkbox', { name: /I have read the terms/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Accept the terms' }));
    await waitFor(() => expect(billing.acceptTerms).toHaveBeenCalledTimes(1));
    expect(billing.acceptTerms).toHaveBeenCalledWith(
      { terms_id: 'terms-of-use', terms_version: '2026-11-01', shown_locale: 'en' },
      expect.anything(),
    );
    expect(await screen.findByText(/You accepted version 2026-11-01/)).toBeInTheDocument();
  });

  it('yeni dildeki metin gelmeden kabul düğmesi çalışmaz', async () => {
    let release: (value: TermsText) => void = () => undefined;
    const billing = fakeClient({
      getTerms: vi.fn((_id: string, locale: 'en' | 'tr') =>
        locale === 'tr'
          ? Promise.resolve(terms.tr)
          : new Promise<TermsText>((resolve) => {
              release = resolve;
            }),
      ),
    });
    const view = renderPage(billing, 'tr');
    await screen.findByText('Hizmeti bu koşullarla kullanırsınız.');
    act(() => view.setLocale('en'));
    // The Turkish text is gone. Nothing can be accepted until the English text arrives.
    expect(screen.queryByText('Hizmeti bu koşullarla kullanırsınız.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accept the terms' })).not.toBeInTheDocument();
    await act(async () => release(terms.en));
    expect(await screen.findByRole('button', { name: 'Accept the terms' })).toBeDisabled();
    expect(billing.acceptTerms).not.toHaveBeenCalled();
  });
});
