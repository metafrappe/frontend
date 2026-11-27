/**
 * Shell test page. For development and browser tests only.
 *
 * TEMPORARY: once the theme moves to the `foundation` task's `src/app/` provider,
 * this page will use it too. For now it passes the derived antd theme
 * from the source file directly.
 */
import '@fontsource-variable/outfit';
import '@fontsource/jetbrains-mono/400.css';

import config from '@design-source/control-size-config.json';
import { App as AntApp, ConfigProvider, theme } from 'antd';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { createApiClient, createCsrfStore, readApiConfig } from '@/api';
import { FALLBACK_LANGUAGE, localeBundle } from '@/app/locale';
import { SAMPLE_CSRF_TOKEN } from '@/mocks/fixtures';
import { startApiMocks } from '@/mocks/start';
import { createApiSource } from '@/views/collection';
import { sampleDefinition } from '@/views/collection/sample';

import { ShellApp } from '../ShellApp';
import { hexToRgba } from '../tokens';
import { createShellHomeData } from '../view-data/home-client';

const light = new URLSearchParams(window.location.search).get('tema') === 'acik';
const base = config.derived.antdTheme;
const token = light
  ? {
      colorPrimary: base.token.colorPrimary,
      colorPrimaryHover: base.token.colorPrimaryHover,
      colorPrimaryActive: base.token.colorPrimaryActive,
      fontSize: base.token.fontSize,
      controlHeight: base.token.controlHeight,
      controlHeightSM: base.token.controlHeightSM,
      controlHeightLG: base.token.controlHeightLG,
      borderRadius: base.token.borderRadius,
    }
  : base.token;

// Source decision D06: in the light theme, primary text is black at 85%.
// In the dark theme, text is the primary colour at 85% and the background the primary colour at 14%.
const pr = config.primary;
const buttonTokens = light
  ? { primaryColor: hexToRgba(pr.light.text, pr.light.opacity) }
  : {
      primaryColor: hexToRgba(pr.dark.text, pr.dark.opacity),
      colorPrimary: hexToRgba(pr.color, pr.dark.background),
      colorPrimaryHover: hexToRgba(pr.color, pr.dark.hoverBackground),
      colorPrimaryActive: hexToRgba(pr.color, pr.dark.activeBackground),
    };

// The test page uses the views-collection sample definition. Every address shows the same sample
// definition. Records come from the shared mock server (MSW). The app entry sets up the real connection.
const mocks = await startApiMocks();
const harnessApi = createApiClient({
  config: readApiConfig({}, window.location.origin),
  csrf: createCsrfStore(mocks.active ? SAMPLE_CSRF_TOKEN : undefined),
});
const harnessViewData = {
  collection: {
    loadDefinition: () => Promise.resolve(sampleDefinition),
    source: createApiSource(harnessApi),
  },
  // The home page (the "Bekleyenler" (pending) page) connects to the same mock server.
  home: createShellHomeData(harnessApi),
};

// The test page opens the shell at the requested address. Example: `?yol=/satis/teklif/TEK-0003`.
// This page has no record connection. A record address renders the shell's sample form.
// Only same-origin paths are accepted.
const startPath = new URLSearchParams(window.location.search).get('yol');
if (startPath?.startsWith('/') && !startPath.startsWith('//')) {
  window.history.replaceState(null, '', startPath);
}

const container = document.getElementById('root');
if (!container) throw new Error('Kök öğe bulunamadı: #root');

createRoot(container).render(
  <StrictMode>
    <ConfigProvider
      // The test page has no session or boot data. The locale is the fallback locale.
      locale={localeBundle(FALLBACK_LANGUAGE).antd}
      theme={{
        algorithm: light ? theme.defaultAlgorithm : theme.darkAlgorithm,
        token: { ...token, fontFamily: "'Outfit Variable', system-ui, sans-serif" },
        components: light
          ? { Button: buttonTokens }
          : { ...base.components, Button: { ...base.components.Button, ...buttonTokens } },
      }}
    >
      <AntApp>
        <ShellApp viewData={harnessViewData} />
      </AntApp>
    </ConfigProvider>
  </StrictMode>,
);
