import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import { collectionRoutes, lazyRoutes } from './routes';
import { buildShellRoutes } from './shellRoutes';
import type { ShellViewData } from './view-data';
import { ViewDataProvider } from './view-data';
import './shell.css';

let router: ReturnType<typeof createBrowserRouter> | undefined;

/**
 * The whole shell. `src/app/App.tsx` renders it inside the providers.
 * `viewData` is the views' data connection. The app entry sets it up with the API.
 * The router is created once at module level.
 * The router runs on the build's base path: `/panel` in production, the root path locally.
 */
export function ShellApp({ viewData = null }: { viewData?: ShellViewData | null }) {
  // `/panel/` -> `/panel`; the root path has no basename. The rule matches `src/app/base-path.ts`.
  // The helper is not imported here: it would create a separate small chunk between the shell and entry chunks.
  const basename = import.meta.env.BASE_URL.replace(/\/+$/, '') || undefined;
  router ??= createBrowserRouter(
    buildShellRoutes(lazyRoutes, collectionRoutes),
    basename ? { basename } : undefined,
  );
  return (
    <ViewDataProvider value={viewData}>
      <RouterProvider router={router} />
    </ViewDataProvider>
  );
}
