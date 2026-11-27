import { useContext, useEffect } from 'react';

import { FocusDimContext } from './context';

/** Turns the focus dim on while active. Multiple users are reference-counted. */
export function useFocusDim(active: boolean) {
  const api = useContext(FocusDimContext);
  useEffect(() => {
    if (!active || !api) return undefined;
    return api.acquire();
  }, [active, api]);
}
