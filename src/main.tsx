import '@fontsource-variable/outfit';
import '@fontsource/jetbrains-mono/400.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { Root } from '@/app/Root';
import { createPlatformSession } from '@/auth';
import {
  installDefaultTrustedTypesPolicy,
  type TrustedTypesTarget,
} from '@/components/safe-html/default-policy';
import { installCspNonce } from '@/design/csp-nonce';
import { SampleDataNotice } from '@/mocks/SampleDataNotice';
import { startApiMocks } from '@/mocks/start';
import { mockWorkerOptions } from '@/mocks/worker-url';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Kök öğe bulunamadı: #root');
}
const root = container;

// Trusted Types varsayılan ilkesi ilk stil öğesinden önce kurulur (GV-2, AJA-2283).
// Sahte sunucu açıksa yalnız onun işçi adresine izin verilir. Koşul `startApiMocks` ile aynıdır.
const mocksOn =
  import.meta.env.VITE_API_MOCKS !== 'off' &&
  (import.meta.env.DEV || import.meta.env.VITE_API_MOCKS === 'on');
installDefaultTrustedTypesPolicy(globalThis as TrustedTypesTarget, {
  scriptUrls: mocksOn ? [mockWorkerOptions(import.meta.env.BASE_URL).url] : [],
});

// Sunucu CSP nonce verdiyse çalışma anında eklenen stil ve betik öğeleri onu taşır.
installCspNonce();

// Sahte sunucu açıksa API isteklerinden önce başlar.
const mocks = await startApiMocks();

// Oturum bir kez kurulur. Tarayıcı erişim belirteci tutmaz (bkz. src/auth/README.md).
const session = createPlatformSession({
  env: {
    VITE_SITE_URL: import.meta.env.VITE_SITE_URL ?? '',
    VITE_KEYCLOAK_URL: import.meta.env.VITE_KEYCLOAK_URL ?? '',
    VITE_KEYCLOAK_REALM: import.meta.env.VITE_KEYCLOAK_REALM ?? '',
    VITE_AI_ROUTE: import.meta.env.VITE_AI_ROUTE ?? '',
    VITE_CSRF_META_NAME: import.meta.env.VITE_CSRF_META_NAME ?? '',
  },
  origin: window.location.origin,
  document,
  navigate: (url) => window.location.assign(url),
  currentPath: () => window.location.pathname + window.location.search,
  // Sahte sunucu açıkken örnek CSRF değeri buradan gelir.
  ...(mocks.active ? { csrfToken: mocks.csrfToken } : {}),
});

createRoot(root).render(
  <StrictMode>
    {mocks.active ? <SampleDataNotice /> : null}
    {/* Sahte sunucu açıkken modüller "Örnek veri" kipindedir. Örnek veri canlı gibi gösterilmez. */}
    <Root session={session} dataMode={mocks.active ? 'example' : 'live'} />
  </StrictMode>,
);
