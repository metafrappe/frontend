import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

import type { ApiClient } from '@/api';
import { routes } from '@/shell/paths';
import type { RecordAddress } from '@/shell/view-data';
import {
  createFrappeRecordAdapter,
  type RecordDataAdapter,
  type RecordLinkTarget,
  RecordView,
} from '@/views/record';

import { useLanguage } from './locale';
import { slugFromDoctype } from './record-slug';
import { doctypeFromSlug, moduleSlug } from './view-data';

function decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

interface ModuleRecordLinkProps {
  adapter: Pick<RecordDataAdapter, 'getDocTypeMeta'>;
  /** If the target type is this page's type, its module is known from the URL; no request is sent. */
  knownModule: string | undefined;
  doctype: string;
  slug: string;
  name: string;
  children: ReactNode;
}

/**
 * Renders a link to the target record under the target type's own module path.
 * The type's schema provides the module. The adapter caches the schema; each type is requested once.
 * Until the module arrives, or if the schema cannot be read, the name stays plain text. No link to a wrong module is rendered.
 */
function ModuleRecordLink({
  adapter,
  knownModule,
  doctype,
  slug,
  name,
  children,
}: ModuleRecordLinkProps) {
  const language = useLanguage();
  const [resolved, setResolved] = useState<{ doctype: string; module: string | undefined }>();
  useEffect(() => {
    if (knownModule) return;
    const controller = new AbortController();
    adapter
      .getDocTypeMeta({ doctype, language, signal: controller.signal })
      .then((meta) => {
        if (controller.signal.aborted) return;
        const module = meta.schema.module ? moduleSlug(meta.schema.module) : '';
        setResolved({ doctype, module: module || undefined });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResolved({ doctype, module: undefined });
      });
    return () => controller.abort();
  }, [adapter, knownModule, doctype, language]);
  const module = knownModule ?? (resolved?.doctype === doctype ? resolved.module : undefined);
  if (!module) return <>{children}</>;
  return <Link to={routes.record(module, slug, name)}>{children}</Link>;
}

export interface RecordRouteProps extends RecordAddress {
  /** The session's shared API client. Site root, CSRF store and session expiry handling come from here. */
  api: Pick<ApiClient, 'frappeDocument'>;
}

/**
 * Record route. The `RecordView` component from the `views-record` work renders the record.
 * Requests go through the shared API client (SZ-5). The shell renders the page frame; this component
 * supplies only the content.
 * The target record in a link field opens under the target type's own module path. For example, the
 * company on a permission record goes to `/setup/company/...`. The router adds the panel path (`/panel`)
 * itself. The target page requests the record from the server; permission is checked there.
 */
export default function RecordRoute({ api, module, doctype, name }: RecordRouteProps) {
  const locale = useLanguage();
  const adapter = useMemo(() => createFrappeRecordAdapter({ api, locale }), [api, locale]);
  const pageDoctype = doctypeFromSlug(doctype);
  const renderRecordLink = useCallback(
    (target: RecordLinkTarget, children: ReactNode) => {
      const slug = slugFromDoctype(target.doctype);
      if (!slug) return null;
      return (
        <ModuleRecordLink
          adapter={adapter}
          knownModule={target.doctype === pageDoctype && module ? module : undefined}
          doctype={target.doctype}
          slug={slug}
          name={target.name}
        >
          {children}
        </ModuleRecordLink>
      );
    },
    [adapter, module, pageDoctype],
  );
  return (
    <RecordView
      doctype={pageDoctype}
      name={decode(name)}
      locale={locale}
      adapter={adapter}
      renderRecordLink={renderRecordLink}
    />
  );
}
