/**
 * Screen texts of the billing page (AJA-1785). Field labels follow the billing country, the
 * language only translates them. Error sentences use the backend's keys and Turkish sentences
 * (`platform_core/translations/tr.csv`), so the screen and the server say the same thing.
 */
import { useModule } from '../context';
import type { AddressField, BillingCountry, FieldErrorKey, PartyKind, TaxIdResult } from './model';

interface BillingCopy {
  title: string;
  intro: string;
  billingSection: string;
  partyKind: string;
  kinds: Record<PartyKind, string>;
  name: string;
  nameHelp: string;
  taxId: string;
  country: string;
  countryPlaceholder: string;
  countries: Record<BillingCountry, string>;
  fields: Record<AddressField, string>;
  optional: string;
  save: string;
  saving: string;
  saved: string;
  saveFailed: string;
  savedSummary: string;
  tax: Record<TaxIdResult, string>;
  errors: Record<FieldErrorKey, string>;
  termsSection: string;
  termsLoading: string;
  termsFailed: string;
  retry: string;
  version: string;
  language: string;
  languages: Record<'en' | 'tr', string>;
  agree: string;
  accept: string;
  accepting: string;
  accepted: (version: string, language: string) => string;
  acceptFailed: string;
}

const en: BillingCopy = {
  title: 'Billing details',
  intro: 'The billing country sets the address fields. The screen language does not change them.',
  billingSection: 'Billing address',
  partyKind: 'Billing party',
  kinds: { person: 'Person', company: 'Company' },
  name: 'Name or company title',
  nameHelp: 'Write the full name in one field. A one-part name is fine.',
  taxId: 'Tax number (optional)',
  country: 'Billing country',
  countryPlaceholder: 'Choose a country',
  countries: { TR: 'Türkiye', GB: 'United Kingdom', DE: 'Germany', US: 'United States' },
  fields: {
    line1: 'Street address',
    line2: 'Address line 2 (optional)',
    district: 'District',
    province: 'Province',
    city: 'City',
    region: 'Region (optional)',
    postal_code: 'Postal code (optional)',
  },
  optional: '(optional)',
  save: 'Save draft',
  saving: 'Saving',
  saved: 'The draft was saved.',
  saveFailed: 'The server did not save the draft. Your entries are still in the form. Try again.',
  savedSummary: 'Saved billing party',
  tax: {
    valid: 'The tax number was confirmed.',
    invalid: 'The tax number is wrong. Check the number and save again.',
    unavailable:
      'The tax number could not be checked right now. Your draft was saved. Save it again later to check the number.',
  },
  errors: {
    'Enter the name or the company title.': 'Enter the name or the company title.',
    'Choose the billing country.': 'Choose the billing country.',
    'Enter the street address.': 'Enter the street address.',
    'Enter the district.': 'Enter the district.',
    'Enter the province.': 'Enter the province.',
    'Enter the city.': 'Enter the city.',
    'Enter the region.': 'Enter the region.',
    'Enter the postal code.': 'Enter the postal code.',
  },
  termsSection: 'Terms of use',
  termsLoading: 'Loading the terms.',
  termsFailed: 'The terms could not be loaded.',
  retry: 'Try again',
  version: 'Version',
  language: 'Language',
  languages: { en: 'English', tr: 'Turkish' },
  agree: 'I have read the terms and I accept them.',
  accept: 'Accept the terms',
  accepting: 'Accepting',
  accepted: (version, language) =>
    `You accepted version ${version} of the terms. The text was in ${language}.`,
  acceptFailed: 'The acceptance was not recorded. Try again.',
};

const tr: BillingCopy = {
  title: 'Fatura bilgileri',
  intro: 'Adres alanlarını fatura ülkesi belirler. Ekran dili bu alanları değiştirmez.',
  billingSection: 'Fatura adresi',
  partyKind: 'Fatura tarafı',
  kinds: { person: 'Kişi', company: 'Şirket' },
  name: 'Ad ya da şirket unvanı',
  nameHelp: 'Adın tamamını tek alana yazın. Tek parçalı ad da olur.',
  taxId: 'Vergi numarası (isteğe bağlı)',
  country: 'Fatura ülkesi',
  countryPlaceholder: 'Bir ülke seçin',
  countries: {
    TR: 'Türkiye',
    GB: 'Birleşik Krallık',
    DE: 'Almanya',
    US: 'Amerika Birleşik Devletleri',
  },
  fields: {
    line1: 'Adres',
    line2: 'Adres devamı (isteğe bağlı)',
    district: 'İlçe',
    province: 'İl',
    city: 'Şehir',
    region: 'Bölge (isteğe bağlı)',
    postal_code: 'Posta kodu (isteğe bağlı)',
  },
  optional: '(isteğe bağlı)',
  save: 'Taslağı kaydet',
  saving: 'Kaydediliyor',
  saved: 'Taslak kaydedildi.',
  saveFailed: 'Sunucu taslağı kaydetmedi. Yazdıklarınız formda duruyor. Yeniden deneyin.',
  savedSummary: 'Kaydedilen fatura tarafı',
  tax: {
    valid: 'Vergi numarası doğrulandı.',
    invalid: 'Vergi numarası yanlış. Numarayı denetleyin ve yeniden kaydedin.',
    unavailable:
      'Vergi numarası şu an denetlenemedi. Taslağınız kaydedildi. Numarayı denetlemek için taslağı sonra yeniden kaydedin.',
  },
  errors: {
    'Enter the name or the company title.': 'Adı ya da şirket unvanını yazın.',
    'Choose the billing country.': 'Fatura ülkesini seçin.',
    'Enter the street address.': 'Sokak ve kapı numarasını yazın.',
    'Enter the district.': 'İlçeyi yazın.',
    'Enter the province.': 'İli yazın.',
    'Enter the city.': 'Şehri yazın.',
    'Enter the region.': 'Bölgeyi yazın.',
    'Enter the postal code.': 'Posta kodunu yazın.',
  },
  termsSection: 'Kullanım koşulları',
  termsLoading: 'Koşullar yükleniyor.',
  termsFailed: 'Koşullar yüklenemedi.',
  retry: 'Yeniden dene',
  version: 'Sürüm',
  language: 'Dil',
  languages: { en: 'İngilizce', tr: 'Türkçe' },
  agree: 'Koşulları okudum ve kabul ediyorum.',
  accept: 'Koşulları kabul et',
  accepting: 'Kabul ediliyor',
  accepted: (version, language) =>
    `Koşulların ${version} sürümünü kabul ettiniz. Metnin dili ${language} idi.`,
  acceptFailed: 'Kabul kaydedilmedi. Yeniden deneyin.',
};

export const billingMessages = { en, tr };

/** The default language is English (Karar 44). */
export function useBillingCopy(): BillingCopy {
  return billingMessages[useModule()?.locale ?? 'en'];
}
