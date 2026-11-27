import type { AppLanguage } from '@/app/locale/language';

/** Favourite button texts. The rejection reason comes from `src/api/error-messages.json`. */
export const FAVOURITE_MESSAGES: Record<AppLanguage, { label: string }> = {
  en: { label: 'Favourite' },
  tr: { label: 'Favori' },
};
