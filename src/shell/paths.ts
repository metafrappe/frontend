/**
 * Address contract (RE-9). All addresses are generated here.
 * The route registry is in `routes.ts`.
 */
import type { ViewType } from './tokens';

export const routePaths = {
  home: '/',
  assistant: '/asistan',
  collection: '/:module/:doctype',
  record: '/:module/:doctype/:name',
  agent: '/ajanlar/:id',
} as const;

export const routes = {
  home: () => '/',
  assistant: () => '/asistan',
  collection: (module: string, doctype: string, view?: ViewType) =>
    `/${encodeURIComponent(module)}/${encodeURIComponent(doctype)}${
      view && view !== 'table' ? `?gorunum=${view}` : ''
    }`,
  record: (module: string, doctype: string, name: string) =>
    `/${encodeURIComponent(module)}/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`,
  agent: (id: string) => `/ajanlar/${encodeURIComponent(id)}`,
};

/** Address parameters. */
export const queryKeys = {
  view: 'gorunum',
  /** Forces a sample data state. Read only on sample pages. */
  demoState: 'durum',
  search: 'ara',
} as const;
