import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';

import { AppShell } from './AppShell';

/** Shell layout. While a page loads, only the content area waits. */
export function ShellLayout() {
  return (
    <AppShell>
      <Suspense fallback={<div className="shell-page" aria-busy="true" />}>
        <Outlet />
      </Suspense>
    </AppShell>
  );
}
