import type { ApiClient } from '@/api';
import { ApiError, userMessage } from '@/api';

import type { ShellHomeData } from './home-data';
import { HomeDataError } from './home-data';

/** Text for an unknown error. Same as the shared error texts. */
const UNKNOWN = 'Bir sorun çıktı. Daha sonra yeniden deneyin.';

function toHomeError(error: unknown): HomeDataError {
  return new HomeDataError(error instanceof ApiError ? userMessage(error) : UNKNOWN);
}

async function guarded<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    // An abort error passes through unchanged. The page does not treat an abort as an error.
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw toHomeError(error);
  }
}

/** Builds the home page connection from the shared API client. */
export function createShellHomeData(
  api: Pick<ApiClient, 'getHomeSummary' | 'approveLeave' | 'rejectLeave'>,
): ShellHomeData {
  return {
    load: (signal) => guarded(() => api.getHomeSummary({ signal })),
    approve: ({ name, version }) =>
      guarded(async () => {
        await api.approveLeave(name, version, {});
      }),
    reject: ({ name, version }) =>
      guarded(async () => {
        await api.rejectLeave(name, version, {});
      }),
  };
}
