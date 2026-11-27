// Panel base path (Vite `base`). In production the panel is served under `/panel/`.
// The backend expects a bundle built with this path (frappesetup backend: platform_core/shell/panel_assets.py).
//
// Rule:
// - If `ATONOTA_BASE` is set, that value is used. It starts with `/`. A trailing `/` is added.
// - Otherwise production mode (`vite build`, `vite preview`) uses `/panel/`.
// - Development and e2e mode run at the root path (`/`).

export const PANEL_BASE = '/panel/';

const SAFE_BASE = /^\/(?:[A-Za-z0-9._~-]+\/)*$/;

export interface ResolveBaseInput {
  mode: string;
  env: Readonly<Record<string, string | undefined>>;
}

export function resolveBase({ mode, env }: ResolveBaseInput): string {
  const raw = env['ATONOTA_BASE'];
  if (raw === undefined || raw === '') return mode === 'production' ? PANEL_BASE : '/';
  const value = raw.endsWith('/') ? raw : `${raw}/`;
  if (!SAFE_BASE.test(value) || value.split('/').some((part) => part === '.' || part === '..')) {
    throw new Error(`ATONOTA_BASE geçersiz: ${JSON.stringify(raw)}. Örnek: /panel/`);
  }
  return value;
}
