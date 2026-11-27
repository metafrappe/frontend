import type { ApiClient } from '@/api';
import type { ModuleEnvironment } from '@/modules';
// The client is imported directly from its file. The `@/modules` entry also carries the registry list.
// The login screen does not download the registry list (initial load budget). Test: `src/modules/e2e/ilk-yuk.spec.ts`.
import { createModuleClient } from '@/modules/client';

import { createShellHomeData } from './home-client';
import { registerHomeData } from './home-data';

export interface ShellModuleEnvironmentInput extends Omit<ModuleEnvironment, 'client' | 'mode'> {
  /** The session's shared API client (`createPlatformSession().api`). */
  api: ApiClient;
  /** Defaults to `live`. Pass `example` for sample data. */
  mode?: ModuleEnvironment['mode'];
}

/**
 * Builds the module environment. The client comes from the shared API client via `createModuleClient`.
 * The `user` field is the Frappe user ID. This value is the `user.name` field in the boot data.
 */
export function createShellModuleEnvironment({
  api,
  mode = 'live',
  ...rest
}: ShellModuleEnvironmentInput): ModuleEnvironment {
  const env: ModuleEnvironment = { ...rest, mode, client: createModuleClient(api) };
  // The home page ("Bekleyenler", pending items) uses the same client. See `home-data.ts`.
  registerHomeData(env, createShellHomeData(api));
  return env;
}
