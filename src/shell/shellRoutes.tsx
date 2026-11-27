import type { LoaderFunctionArgs, RouteObject } from 'react-router-dom';
import { data } from 'react-router-dom';

import { AppShell } from './layout/AppShell';
import { ShellLayout } from './layout/ShellLayout';
import NotFoundPage from './pages/NotFoundPage';
import { RouteErrorPage } from './pages/RouteErrorPage';
import type { RouteEntry } from './routes';
import { isReservedSegment, toRouteObjects } from './routes';

/** Reserved prefixes (`/_demo/`, `/panel/`) do not fall through to the collection page. They return 404. */
function guardReserved({ params }: LoaderFunctionArgs) {
  if (isReservedSegment(params['module'])) throw data(null, { status: 404 });
  return null;
}

/**
 * The shell's router entries.
 * First the `lazy` rows, then the collection paths, and finally 404.
 * Each page has its own error screen. So the shell stays in place when an error occurs.
 */
export function buildShellRoutes(lazy: RouteEntry[], collection: RouteEntry[]): RouteObject[] {
  const withError = (o: RouteObject): RouteObject => ({ ...o, errorElement: <RouteErrorPage /> });
  return [
    {
      element: <ShellLayout />,
      errorElement: (
        <AppShell>
          <RouteErrorPage />
        </AppShell>
      ),
      children: [
        ...toRouteObjects(lazy).map(withError),
        ...toRouteObjects(collection).map((o) => ({ ...withError(o), loader: guardReserved })),
        { path: '*', element: <NotFoundPage /> },
      ],
    },
  ];
}
