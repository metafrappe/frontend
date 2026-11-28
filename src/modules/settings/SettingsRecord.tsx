import { Alert } from 'antd';
import { useMemo } from 'react';

import { createFrappeRecordAdapter, RecordView } from '@/views/record';

import { useModule } from '../context';
import { settingsMessages, type SettingsMessageKey } from './messages';

/**
 * Tek kayıtlı ayar türünü kayıt formuyla açar (G-97). Form elle yazılmaz.
 * `RecordView` alanları, bölümleri ve doğrulamayı türün şemasından çizer (G-69, G-71).
 * Kaydın adı türün adıdır. Okuma ve yazma yetkisini sunucu her istekte denetler.
 */
export function SettingsRecord({ doctype, title }: { doctype: string; title: SettingsMessageKey }) {
  const env = useModule();
  const locale = env?.locale ?? 'tr';
  const copy = settingsMessages[locale];
  const api = env?.client?.records;
  const adapter = useMemo(
    () => (api ? createFrappeRecordAdapter({ api, locale }) : undefined),
    [api, locale],
  );
  if (!adapter) return <Alert type="warning" showIcon role="alert" message={copy.noClient} />;
  return (
    <RecordView
      doctype={doctype}
      name={doctype}
      title={copy[title]}
      saveActionLabel={copy.save}
      locale={locale}
      adapter={adapter}
    />
  );
}
