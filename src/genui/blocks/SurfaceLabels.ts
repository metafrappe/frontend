import type { RiskLevel } from '../types';

/**
 * Risk düzeyinin rozet tonu. Renk tek başına anlam taşımaz: düzey her zaman yazıyla da yazar.
 * Metinler `../strings.ts` dosyasındadır. Sunucu yalnız kodu gönderir.
 */
export const RISK_TONE: Record<RiskLevel, 'info' | 'warn' | 'danger'> = {
  R0: 'info',
  R1: 'info',
  R2: 'warn',
  R3: 'danger',
};
