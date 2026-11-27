import { useLanguage } from '@/app/locale';

import { genuiStrings, type GenuiStrings } from './strings';

/** GenUI card texts for the current UI language (AJA-1859). */
export function useGenuiStrings(): GenuiStrings {
  return genuiStrings(useLanguage());
}
