import { App as AntdApp, ConfigProvider, theme as antdThemeApi } from 'antd';
import { useEffect, useMemo, type ReactNode } from 'react';

import { buildAntdTheme } from '@/design/antd-theme';
import { installCspNonce } from '@/design/csp-nonce';
import { ensureDesignStyles } from '@/design/css-variables';
import { FocusDimOverlay } from '@/engines/focus-dim';
import { startFocusMode } from '@/engines/focus-mode';
import { startHitAreaEngine } from '@/engines/hit-area';

import { LanguageProvider, useLocaleBundle, type SiteFormatting } from './locale';
import { ThemeModeProvider, useThemeMode, type ThemeModeChoice } from './theme-mode';
import { usePrefersReducedMotion } from './use-reduced-motion';

/** Body background and text colour come from antd tokens; the page root follows the theme too. */
function BodyTheme() {
  const { token } = antdThemeApi.useToken();
  useEffect(() => {
    document.body.style.backgroundColor = token.colorBgLayout;
    document.body.style.color = token.colorText;
  }, [token.colorBgLayout, token.colorText]);
  return null;
}

/**
 * The server's CSP nonce value. It is read once when the page opens; the value stays the same for the page's lifetime.
 * antd and other libraries give this value to the style elements they add at runtime.
 * Setup happens before the children render. If there is no value, no element gets a nonce.
 */
function useCspConfig(): { nonce: string } | undefined {
  return useMemo(() => {
    const nonce = installCspNonce();
    return nonce ? { nonce } : undefined;
  }, []);
}

function ThemedProviders({ children }: { children: ReactNode }) {
  const { resolved } = useThemeMode();
  const csp = useCspConfig();
  const reducedMotion = usePrefersReducedMotion();
  const { antd: locale } = useLocaleBundle();
  const theme = useMemo(
    () => buildAntdTheme(resolved, { reducedMotion }),
    [resolved, reducedMotion],
  );

  return (
    <ConfigProvider theme={theme} locale={locale} {...(csp ? { csp } : {})}>
      <AntdApp>
        <BodyTheme />
        {children}
        <FocusDimOverlay />
      </AntdApp>
    </ConfigProvider>
  );
}

export interface AppProvidersProps {
  children: ReactNode;
  initialThemeChoice?: ThemeModeChoice;
  /**
   * Initial language. Defaults to the fallback language. Once the session opens, the language comes from the bootstrap data.
   * Tests supply the language here.
   */
  initialLanguage?: string;
  /** Initial time zone and currency. Once the session opens, they come from the bootstrap data. Tests supply them here. */
  initialFormatting?: SiteFormatting;
  /** For turning the engines off in tests. Enabled by default. */
  engines?: boolean;
}

/**
 * Application root: language context, design CSS, theme mode, antd ConfigProvider,
 * focus mode engine, touch target engine and focus scrim.
 */
export function AppProviders({
  children,
  initialThemeChoice,
  initialLanguage,
  initialFormatting,
  engines = true,
}: AppProvidersProps) {
  useEffect(() => {
    ensureDesignStyles();
  }, []);

  useEffect(() => {
    if (!engines) return;
    const stopFocus = startFocusMode();
    const hit = startHitAreaEngine();
    return () => {
      stopFocus();
      hit.stop();
    };
  }, [engines]);

  return (
    <LanguageProvider initialLanguage={initialLanguage} initialFormatting={initialFormatting}>
      <ThemeModeProvider {...(initialThemeChoice ? { initialChoice: initialThemeChoice } : {})}>
        <ThemedProviders>{children}</ThemedProviders>
      </ThemeModeProvider>
    </LanguageProvider>
  );
}
