import type { ComponentType } from 'react';

import { ModuleProvider } from '@/modules';

import { useShellAccess } from '../access';
import { t } from '../messages';
import { moduleAllowed } from '../nav';
import { useViewData } from '../view-data';

function Note({ text }: { text: string }) {
  return (
    <div className="shell-page">
      <div className="shell-body">
        <p role="status">{text}</p>
      </div>
    </div>
  );
}

/**
 * Opens a module page inside `ModuleProvider`.
 * The app entry provides the environment via the `viewData.modules` field.
 * Without the environment the page does not open. It shows a status message instead.
 * The page goes through the same permission gate as the menu (G-94, G-169). If the gate is closed, a permission note appears.
 * The gate only shapes the screen. The server still checks permission on every request.
 */
export function ModuleBoundary({ page: Page, path }: { page: ComponentType; path?: string }) {
  const env = useViewData()?.modules;
  const access = useShellAccess();
  if (!env) return <Note text={t.pages.noModuleEnvironment} />;
  if (access && !access.ready) return <Note text={t.pages.checkingAccess} />;
  if (access && path !== undefined && !moduleAllowed(path, access.readable))
    return <Note text={t.pages.denied} />;
  return (
    <ModuleProvider value={env}>
      <Page />
    </ModuleProvider>
  );
}
