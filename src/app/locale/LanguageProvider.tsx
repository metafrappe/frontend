import dayjs from 'dayjs';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { createFormatter, type Formatter, type SiteFormatting } from './format';
import {
  FALLBACK_LOCALE,
  catalogLanguage,
  resolveLocale,
  type AppLanguage,
  type LocaleTag,
} from './language';
import { localeBundle, type LocaleBundle } from './locale-map';

interface LanguageState {
  /** Full locale tag. Example: `de-DE`. Formats, Ant Design and `<html lang>` use it. */
  locale: LocaleTag;
  /** Text catalogue language of the locale. */
  language: AppLanguage;
  /**
   * Açılış verisindeki ham profil dilini ve biliniyorsa kiracı ayarını alır.
   * Sıra şöyledir: profil, kiracı, yedek `en-GB`. Tarayıcı dili kullanılmaz.
   */
  setLanguage: (raw: string | null | undefined, tenant?: string | null | undefined) => void;
  /** Kullanıcının seçtiği dili uygular. Çağıran seçimi önce profile kaydeder. */
  applyLocale: (locale: LocaleTag) => void;
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
  locale: FALLBACK_LOCALE,
  language: catalogLanguage(FALLBACK_LOCALE),
  setLanguage: () => undefined,
  applyLocale: () => undefined,
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
  const [locale, setLocale] = useState<LocaleTag>(() => resolveLocale(initialLanguage));
  const language = catalogLanguage(locale);
  const [formatting, setFormattingState] = useState<SiteFormatting>(() => initialFormatting ?? {});
  // İşlevler sabit kalır. Dil değişince açılış verisi yeniden istenmez.
  const setLanguage = useCallback<LanguageState['setLanguage']>(
    (raw, tenant) => setLocale(resolveLocale(raw, tenant)),
    [],
  );
  const applyLocale = useCallback<LanguageState['applyLocale']>((next) => setLocale(next), []);
  const setFormatting = useCallback<LanguageState['setFormatting']>(
    (next) =>
      setFormattingState((prev) =>
        prev.time_zone === next.time_zone && prev.currency === next.currency ? prev : next,
      ),
    [],
  );
  const value = useMemo<LanguageState>(
    () => ({ locale, language, setLanguage, applyLocale, formatting, setFormatting }),
    [locale, language, setLanguage, applyLocale, formatting, setFormatting],
  );
  // IC-14: sayfa dili seçili dili izler. Sunulan bütün diller soldan sağa yazılır.
  // Durum değişimi sayfayı yeniden yüklemez ve ağacı yeniden kurmaz. Formlar ve taslaklar kalır.
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = 'ltr';
  }, [locale]);
  // Day.js dili genel bir ayardır. Çocuklar çizilmeden önce kurulur; tarih seçici ilk çizimde doğru dili alır.
  // Çağrı aynı dille tekrarlansa da sonuç değişmez.
  dayjs.locale(localeBundle(locale).dayjs);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

function useLanguageState(): LanguageState {
  return useContext(LanguageContext);
}

/** Geçerli tam dil etiketi. Örnek: `de-DE`. */
export function useLocale(): LocaleTag {
  return useLanguageState().locale;
}

/** Kullanıcının seçtiği dili uygulayan işlev. */
export function useApplyLocale(): LanguageState['applyLocale'] {
  return useLanguageState().applyLocale;
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
  const { locale, language, formatting } = useLanguageState();
  const { time_zone: timeZone, currency } = formatting;
  return useMemo(
    () => createFormatter({ language, locale, timeZone, currency }),
    [language, locale, timeZone, currency],
  );
}

/** Geçerli dilin antd, Ant Design X ve Day.js nesneleri. */
export function useLocaleBundle(): LocaleBundle {
  return localeBundle(useLocale());
}
