import dayjs from 'dayjs';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { createFormatter, type Formatter, type SiteFormatting } from './format';
import { FALLBACK_LANGUAGE, resolveLanguage, type AppLanguage } from './language';
import { localeBundle, type LocaleBundle } from './locale-map';

interface LanguageState {
  language: AppLanguage;
  /** Açılış verisindeki ham dili alır. Boş dil yedek dile düşer. */
  setLanguage: (raw: string | null | undefined) => void;
  /** Açılış verisindeki saat dilimi ve para birimi (IC-13). */
  formatting: SiteFormatting;
  /** Açılış verisi gelince saat dilimini ve para birimini kaydeder. */
  setFormatting: (formatting: SiteFormatting) => void;
}

/**
 * Sağlayıcı yoksa yedek dil geçerlidir. Örnek: bileşen tek başına sınanır.
 * Bu durumda dil değiştirilemez.
 */
const LanguageContext = createContext<LanguageState>({
  language: FALLBACK_LANGUAGE,
  setLanguage: () => undefined,
  formatting: {},
  setFormatting: () => undefined,
});

/**
 * Uygulamanın tek dil bağlamı. Dil, açılış verisindeki kullanıcı dilinden gelir.
 * Oturum açılmadan önce dil yedek dildir.
 */
export function LanguageProvider({
  initialLanguage,
  initialFormatting,
  children,
}: {
  initialLanguage?: string | null | undefined;
  /** Başlangıç saat dilimi ve para birimi. Testler buradan verir. */
  initialFormatting?: SiteFormatting | undefined;
  children: ReactNode;
}) {
  const [language, setResolved] = useState<AppLanguage>(() => resolveLanguage(initialLanguage));
  const [formatting, setFormattingState] = useState<SiteFormatting>(() => initialFormatting ?? {});
  // İşlevler sabit kalır. Dil değişince açılış verisi yeniden istenmez.
  const setLanguage = useCallback<LanguageState['setLanguage']>(
    (raw) => setResolved(resolveLanguage(raw)),
    [],
  );
  const setFormatting = useCallback<LanguageState['setFormatting']>(
    (next) =>
      setFormattingState((prev) =>
        prev.time_zone === next.time_zone &&
        prev.currency === next.currency &&
        prev.format_locale === next.format_locale
          ? prev
          : next,
      ),
    [],
  );
  const value = useMemo<LanguageState>(
    () => ({ language, setLanguage, formatting, setFormatting }),
    [language, setLanguage, formatting, setFormatting],
  );
  // Day.js dili genel bir ayardır. Çocuklar çizilmeden önce kurulur; tarih seçici ilk çizimde doğru dili alır.
  // Çağrı aynı dille tekrarlansa da sonuç değişmez.
  dayjs.locale(localeBundle(language).dayjs);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

function useLanguageState(): LanguageState {
  return useContext(LanguageContext);
}

/** Arayüzün geçerli dili. */
export function useLanguage(): AppLanguage {
  return useLanguageState().language;
}

/** Açılış verisi gelince dili değiştiren işlev. */
export function useSetLanguage(): LanguageState['setLanguage'] {
  return useLanguageState().setLanguage;
}

/** Açılış verisi gelince saat dilimini ve para birimini kaydeden işlev. */
export function useSetFormatting(): LanguageState['setFormatting'] {
  return useLanguageState().setFormatting;
}

/**
 * Geçerli dilin, saat diliminin ve para biriminin biçimleyicisi (IC-13).
 * Örnek: `useFormat().date('2026-11-27')`.
 */
export function useFormat(): Formatter {
  const { language, formatting } = useLanguageState();
  const { time_zone: timeZone, currency } = formatting;
  return useMemo(
    () => createFormatter({ language, timeZone, currency }),
    [language, timeZone, currency],
  );
}

/** Geçerli dilin antd, Ant Design X ve Day.js nesneleri. */
export function useLocaleBundle(): LocaleBundle {
  return localeBundle(useLanguage());
}
