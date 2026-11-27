import { useCallback, useState } from 'react';

import { isNotOlder } from '@/api';

/**
 * Ekrandaki kaydı tutar. Eski sürümlü yanıt gelirse ekrandaki yeni değer korunur.
 * Sözleşme 7. bölüm: "Ekrandaki değerden eski bir yanıtı ekrana yazmaz."
 */
export function useLatestRecord<T>(initial: T, versionOf: (value: T) => string) {
  const [record, setRecord] = useState(initial);
  const accept = useCallback(
    (next: T) => {
      setRecord((current) => (isNotOlder(versionOf(next), versionOf(current)) ? next : current));
    },
    [versionOf],
  );
  return [record, accept] as const;
}
