/**
 * Test data for the plan detail component (AJA-1744).
 *
 * The server does not send plan data yet. These names, prices and features are NOT real.
 * The component marks them as sample data on screen (`sample: true`).
 *
 * This is the only file that changes when the real contract arrives:
 * - the price tax status comes from AJA-1731,
 * - the language, region and currency come from AJA-1732.
 * Until then the tax status is `unknown`. The screen then says that the tax status is unknown;
 * it never shows "0.00" tax.
 */
import type { PlanDetailData } from './plan-types';

/** The shared prefix of the two plan names. It is exactly 30 characters long. */
export const SHARED_PREFIX = 'Geschäftskundenbetreuungspaket';

function features(users: string): PlanDetailData['features'] {
  return [
    { key: 'users', label: 'Kullanıcı sayısı', value: { kind: 'text', text: users } },
    {
      key: 'temperature',
      label: 'Betriebsumgebungstemperatur',
      lang: 'de',
      value: { kind: 'range', min: -20, max: 60, unit: 'celsius' },
    },
    {
      key: 'storage',
      label: 'Depolama',
      value: { kind: 'quantity', amount: 50, unit: 'gigabyte' },
    },
    { key: 'backup', label: 'Yedekleme', value: { kind: 'text', text: 'Günlük' } },
    { key: 'support', label: 'Destek', value: { kind: 'text', text: 'E-posta' } },
  ];
}

export const TEST_PLANS: readonly PlanDetailData[] = [
  {
    id: 'test-plan-a',
    name: `${SHARED_PREFIX} Plus 10`,
    nameLang: 'de',
    variant: 'Plus 10',
    summary: '10 kullanıcı',
    price: { amount: 100, currency: 'EUR', period: 'month' },
    tax: 'unknown',
    features: features('10'),
    sample: true,
  },
  {
    id: 'test-plan-b',
    name: `${SHARED_PREFIX} Plus 25`,
    nameLang: 'de',
    variant: 'Plus 25',
    summary: '25 kullanıcı',
    price: { amount: 200, currency: 'EUR', period: 'month' },
    tax: 'unknown',
    features: features('25'),
    sample: true,
  },
];

/** A long error message. It must stay below its own field and must not cover another field. */
export const LONG_ERROR =
  'Bu plan şu anda seçilemiyor. Sunucu isteği kabul etmedi. Birkaç dakika sonra yeniden deneyin. Sorun sürerse site yöneticinize "Betriebsumgebungstemperatur" ayarını sorun.';
