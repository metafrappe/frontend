import type { HomeSummary, PendingApproval } from '@/api';
import type { ModuleEnvironment } from '@/modules';

/** Identity of an approve or reject request. `version` is the version of the record that was read. */
export type HomeDecisionTarget = Pick<PendingApproval, 'name' | 'version'>;

/**
 * Data connection for the home page ("Bekleyenler", pending items).
 * The shell does not create an API client. `createShellHomeData` builds the connection from the shared client.
 * On error the functions reject with `HomeDataError`. The error text is shown to the user.
 */
export interface ShellHomeData {
  /** Reads four parts: pending approvals, problem records, recent changes, summary counts. */
  load: (signal: AbortSignal) => Promise<HomeSummary>;
  approve: (target: HomeDecisionTarget) => Promise<void>;
  reject: (target: HomeDecisionTarget) => Promise<void>;
}

/** An error to show to the user. `message` is a plain Turkish sentence. */
export class HomeDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HomeDataError';
  }
}

/**
 * Home page connection tied to the module environment.
 * The app entry builds the module environment with `createShellModuleEnvironment`.
 * That function also writes the home page connection here, so the entry does not have to pass a separate field.
 */
const byEnvironment = new WeakMap<ModuleEnvironment, ShellHomeData>();

export function registerHomeData(env: ModuleEnvironment, data: ShellHomeData): void {
  byEnvironment.set(env, data);
}

export function homeDataForModules(env: ModuleEnvironment | undefined): ShellHomeData | undefined {
  return env ? byEnvironment.get(env) : undefined;
}
