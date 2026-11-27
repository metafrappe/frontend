import { useSyncExternalStore } from 'react';

import type { Auth, AuthState } from './auth';

/** Binds the sign-in state to a React component. */
export function useAuthState(auth: Pick<Auth, 'getState' | 'subscribe'>): AuthState {
  return useSyncExternalStore(auth.subscribe, auth.getState, auth.getState);
}
