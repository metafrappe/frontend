import '@fontsource-variable/outfit';
import '@fontsource/jetbrains-mono/400.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { Root } from '@/app/Root';
import { createPlatformSession } from '@/auth';
import { installCspNonce } from '@/design/csp-nonce';
import { SampleDataNotice } from '@/mocks/SampleDataNotice';
import { startApiMocks } from '@/mocks/start';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Kök öğe bulunamadı: #root');
}
const root = container;

// If the server supplied a CSP nonce, style and script elements added at runtime carry it.
installCspNonce();

// If the mock server is enabled, it starts before any API requests.
const mocks = await startApiMocks();

// The session is created once. The browser holds no access token (see src/auth/README.md).
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
  // When the mock server is enabled, the sample CSRF value comes from here.
  ...(mocks.active ? { csrfToken: mocks.csrfToken } : {}),
});

createRoot(root).render(
  <StrictMode>
    {mocks.active ? <SampleDataNotice /> : null}
    {/* When the mock server is enabled, modules run in sample-data mode. Sample data is never shown as live. */}
    <Root session={session} dataMode={mocks.active ? 'example' : 'live'} />
  </StrictMode>,
);
