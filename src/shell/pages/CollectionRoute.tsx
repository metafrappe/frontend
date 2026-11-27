import { ArrowClockwise } from '@phosphor-icons/react';
import { Button, theme } from 'antd';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import type { CollectionDefinition } from '@/views/collection';
import { CollectionView } from '@/views/collection';

import { isDarkColor } from '../focus-dim/isDarkColor';
import { t } from '../messages';
import { routes } from '../paths';
import { useViewData } from '../view-data';

type Loaded =
  | { key: string; status: 'ready'; definition: CollectionDefinition }
  | { key: string; status: 'error' };

/**
 * Liste rotası. Koleksiyonu yalnız `views-collection` işinin `CollectionView`
 * bileşeni çizer. Kabuk yalnız tanımı getirir ve sayfa başlığını verir.
 */
export default function CollectionRoute() {
  const { module = '', doctype = '' } = useParams();
  const viewData = useViewData();
  const data = viewData?.collection;
  const workspace = viewData?.workspaces?.current;
  const { token } = theme.useToken();
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const key = `${module}/${doctype}/${attempt}`;

  useEffect(() => {
    if (!data) return undefined;
    const ctrl = new AbortController();
    data.loadDefinition({ module, doctype }, ctrl.signal).then(
      (definition) => {
        if (!ctrl.signal.aborted) setLoaded({ key, status: 'ready', definition });
      },
      () => {
        if (!ctrl.signal.aborted) setLoaded({ key, status: 'error' });
      },
    );
    return () => ctrl.abort();
  }, [data, module, doctype, key]);

  if (!data) {
    return (
      <div className="shell-page">
        <div className="shell-body">
          <p role="status">{t.pages.noDataSource}</p>
        </div>
      </div>
    );
  }

  // Yanıt bu adrese ait değilse tanım yükleniyor sayılır. Eski yanıt yeni sayfayı ezmez.
  const current = loaded?.key === key ? loaded : null;
  // Tanım gelmeden sayfa başlığı adresteki türün adıdır. Ad verilmezse genel başlık kullanılır.
  const title = data.title?.({ module, doctype }) || t.pages.records;

  if (!current) {
    return (
      <div className="shell-page" aria-busy="true">
        <div className="shell-body">
          <h1 className="shell-vh">{title}</h1>
          <p role="status">{t.header.state.loading}</p>
        </div>
      </div>
    );
  }

  if (current.status === 'error') {
    return (
      <div className="shell-page">
        <div className="shell-body">
          <h1 className="shell-h1">{title}</h1>
          <div className="shell-hd-err" role="alert">
            <span>{t.pages.definitionError}</span>
            <Button
              icon={<ArrowClockwise aria-hidden="true" />}
              onClick={() => setAttempt((n) => n + 1)}
            >
              {t.header.state.retry}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="shell-page">
      <div className="shell-body">
        {/* CollectionView başlığı h2 düzeyindedir. Sayfanın h1 başlığını kabuk verir. */}
        <h1 className="shell-vh">{current.definition.label}</h1>
        <CollectionView
          definition={current.definition}
          source={data.source}
          mode={isDarkColor(token.colorBgLayout) ? 'dark' : 'light'}
          recordHref={(name) => routes.record(module, doctype, name)}
          workspace={workspace}
        />
      </div>
    </div>
  );
}
