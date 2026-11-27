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
  type SiteFormatting,
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
  /** Hedef tür bu sayfanın türüyse modülü adresten bilinir; istek atılmaz. */
  knownModule: string | undefined;
  doctype: string;
  slug: string;
  name: string;
  children: ReactNode;
}

/**
 * Hedef kayda, hedef türün kendi modül yolunda bağlantı çizer.
 * Modülü türün şeması verir. Şemayı bağdaştırıcı önbelleğe alır; aynı tür bir kez istenir.
 * Modül gelene kadar ve şema okunamazsa ad düz metin kalır. Yanlış modüle bağlantı çizilmez.
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
  /** Oturumun ortak API istemcisi. Site kökü, CSRF deposu ve oturum süresi işi buradan gelir. */
  api: Pick<ApiClient, 'frappeDocument' | 'getBootstrap'>;
}

/**
 * Kullanıcının biçim ayarını açılış verisinden okur. Örnek: tarih kalıbı `dd.mm.yyyy`.
 * Ayar okunamazsa kayıt yine açılır; alanlar arayüz dilinin varsayılanını kullanır.
 */
function useSiteFormatting(api: Pick<ApiClient, 'getBootstrap'>): SiteFormatting | undefined {
  const [formatting, setFormatting] = useState<SiteFormatting | undefined>(undefined);
  useEffect(() => {
    const controller = new AbortController();
    api
      .getBootstrap({ signal: controller.signal })
      .then((bootstrap) => {
        if (!controller.signal.aborted) setFormatting(bootstrap.formatting);
      })
      .catch(() => {
        /* Biçim ayarı yoksa alanlar dil varsayılanını kullanır. */
      });
    return () => controller.abort();
  }, [api]);
  return formatting;
}

/**
 * Kayıt rotası. Kaydı `views-record` işinin `RecordView` bileşeni çizer.
 * İstekler ortak API istemcisinden geçer (SZ-5). Sayfa çerçevesini kabuk çizer; bu bileşen
 * yalnız içeriği verir.
 * Bağlantı alanındaki hedef kayıt, hedef türün kendi modül yolunda açılır. Örneğin izin
 * kaydındaki şirket `/setup/company/...` adresine gider. Yönlendirici panel yolunu (`/panel`)
 * kendisi ekler. Hedef sayfa kaydı sunucudan ister; izin orada denetlenir.
 */
export default function RecordRoute({ api, module, doctype, name }: RecordRouteProps) {
  const locale = useLanguage();
  const adapter = useMemo(() => createFrappeRecordAdapter({ api, locale }), [api, locale]);
  const pageDoctype = doctypeFromSlug(doctype);
  const formatting = useSiteFormatting(api);
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
      formatting={formatting}
      adapter={adapter}
      renderRecordLink={renderRecordLink}
    />
  );
}
