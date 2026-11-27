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
 * List route. Only the `views-collection` task's `CollectionView` component
 * renders the collection. The shell only fetches the definition and provides the page header.
 */
export default function CollectionRoute() {
  const { module = '', doctype = '' } = useParams();
  const data = useViewData()?.collection;
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

  // If the response is not for this address, the definition counts as loading. A stale response does not overwrite the new page.
  const current = loaded?.key === key ? loaded : null;
  // Before the definition arrives, the page header is the type name from the address. Without a name the generic title is used.
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
        {/* The CollectionView heading is at h2 level. The shell provides the page's h1. */}
        <h1 className="shell-vh">{current.definition.label}</h1>
        <CollectionView
          definition={current.definition}
          source={data.source}
          mode={isDarkColor(token.colorBgLayout) ? 'dark' : 'light'}
          recordHref={(name) => routes.record(module, doctype, name)}
        />
      </div>
    </div>
  );
}
