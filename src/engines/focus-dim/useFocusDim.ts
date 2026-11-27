import { useEffect, useId } from 'react';

import { setFocusDim } from './focus-dim';

/** Opens the dim layer while the component is `open`; closes it on close or unmount. */
export function useFocusDim(open: boolean, key?: string): void {
  const autoKey = useId();
  const k = key ?? autoKey;
  useEffect(() => {
    setFocusDim(k, open);
    return () => setFocusDim(k, false);
  }, [k, open]);
}
