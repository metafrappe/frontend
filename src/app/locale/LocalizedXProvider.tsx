import { XProvider } from '@ant-design/x';
import type { ReactNode } from 'react';

import { useLocaleBundle } from './LanguageProvider';

/**
 * Ant Design X provider. Its locale is the merged X object for the application language.
 * It lives in a separate file: the language context loads on first load, the X package loads only with screens that use X.
 */
export function LocalizedXProvider({ children }: { children: ReactNode }) {
  const { x } = useLocaleBundle();
  return <XProvider locale={x}>{children}</XProvider>;
}
