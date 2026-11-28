import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError, userMessage } from '@/api';

import { UI_LOCALES, type LocaleTag } from './language';
import { useApplyLocale, useLanguage, useLocale } from './LanguageProvider';

/** Seçilen dili kullanıcı profiline kaydeder. Sunucu reddederse hata verir. */
export type SaveLanguage = (locale: LocaleTag, signal: AbortSignal) => Promise<void>;

/** Dil düğmesinin görünen metinleri. */
const MESSAGES = {
  en: {
    label: 'Language',
    saving: 'Saving the language.',
    failed: (reason: string) => `The language did not change. ${reason}`,
    unknown: 'The server did not save the choice. Try again.',
  },
  tr: {
    label: 'Dil',
    saving: 'Dil kaydediliyor.',
    failed: (reason: string) => `Dil değişmedi. ${reason}`,
    unknown: 'Sunucu seçimi kaydetmedi. Yeniden deneyin.',
  },
} as const;

export interface LanguageChoice {
  /** Ekranın şu an kullandığı dil. */
  locale: LocaleTag;
  /** Kaydedilen dil. Kayıt yoksa `undefined` olur. */
  pending: LocaleTag | undefined;
  /** Son reddedilen kaydın neden metni. Başarılı kayıttan sonra `undefined` olur. */
  error: string | undefined;
  /** Sunulan diller. Her dilin adı kendi dilindedir. */
  options: typeof UI_LOCALES;
  /** Geçerli dildeki görünen metinler. */
  text: (typeof MESSAGES)[keyof typeof MESSAGES];
  /**
   * Bir dil seçer. Seçim hedef durumdur (AJA-1772).
   * Geçerli dili yeniden seçmek istek göndermez. Kayıt sürerken yeni seçim yok sayılır.
   * Ekran yalnız profil kaydı başarılı olunca değişir. Sayfa yeniden yüklenmez.
   */
  choose: (locale: LocaleTag) => void;
}

function isOffered(value: string): value is LocaleTag {
  return UI_LOCALES.some((entry) => entry.tag === value);
}

/** Dil düğmesinin durumu ve işlemleri. `save` seçimi profile yazar. */
export function useLanguageChoice(save: SaveLanguage): LanguageChoice {
  const locale = useLocale();
  const language = useLanguage();
  const applyLocale = useApplyLocale();
  const [pending, setPending] = useState<LocaleTag | undefined>(undefined);
  const [failure, setFailure] = useState<unknown>(undefined);
  const busy = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const text = MESSAGES[language];

  useEffect(
    () => () => {
      controller.current?.abort();
    },
    [],
  );

  const choose = useCallback(
    (next: LocaleTag) => {
      if (!isOffered(next) || busy.current || next === locale) return;
      busy.current = true;
      const ctrl = new AbortController();
      controller.current = ctrl;
      setPending(next);
      setFailure(undefined);
      save(next, ctrl.signal).then(
        () => {
          busy.current = false;
          if (ctrl.signal.aborted) return;
          setPending(undefined);
          applyLocale(next);
        },
        (error: unknown) => {
          busy.current = false;
          if (ctrl.signal.aborted) return;
          setPending(undefined);
          setFailure(error ?? new Error('save failed'));
        },
      );
    },
    [applyLocale, locale, save],
  );

  const error =
    failure === undefined
      ? undefined
      : text.failed(failure instanceof ApiError ? userMessage(failure, language) : text.unknown);

  return { locale, pending, error, options: UI_LOCALES, text, choose };
}
