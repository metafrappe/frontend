import { X } from '@phosphor-icons/react';
import { forwardRef, useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';

import { Switch } from '@/components/controls/Switch';

import { t } from '../messages';
import type { QuickAction } from '../nav';
import type { ShellHelpAnswer, ShellHelpData } from '../view-data/context';
import { useViewData } from '../view-data/useViewData';
import type { HelpTarget } from './context';
import { helpLinks } from './links';

import './help-panel.css';

export type HelpPanelMode = 'dock' | 'drawer';

interface Loaded {
  key: string;
  answer: ShellHelpAnswer | null;
}

/** Sunucuya sorulacak konu. Sayfa yardımı ve belge türü olmayan alan sorulmaz. */
function requestOf(target: HelpTarget, help: ShellHelpData | undefined) {
  if (!help) return null;
  if (target.kind === 'component') {
    return {
      key: `c:${target.componentId}`,
      load: (signal: AbortSignal) => help.loadComponent(target.componentId, signal),
    };
  }
  if (target.kind === 'field' && target.doctype) {
    const query = { doctype: target.doctype, fieldname: target.fieldname };
    return {
      key: `f:${query.doctype}:${query.fieldname}`,
      load: (signal: AbortSignal) => help.loadField(query, signal),
    };
  }
  return null;
}

/**
 * Alan ya da bileşen bölümünün metni.
 * Sıra: sunucu yardımı, sonra alan açıklaması, sonra "yardım metni yok".
 * Sunucu yanıtı beklenirken yedek metin yoksa "yükleniyor" yazılır.
 */
function targetText(
  target: HelpTarget,
  server: { loading: boolean; answer: ShellHelpAnswer | null },
): string {
  const fromServer = server.answer?.content?.trim();
  if (fromServer) return fromServer;
  const fallback = target.kind === 'field' ? target.description?.trim() : undefined;
  if (fallback) return fallback;
  if (server.loading) return t.help.loading;
  return target.kind === 'component' ? t.help.componentEmpty : t.help.fieldEmpty;
}

/**
 * Konunun sunucu yardımını okur (G-138).
 * İstek başarısız olursa yardım yok sayılır. Panel açık kalır ve bağlantı çizilmez.
 */
function useServerHelp(target: HelpTarget) {
  const help = useViewData()?.help;
  const request = requestOf(target, help);
  const key = request?.key ?? null;
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (!request) return undefined;
    const controller = new AbortController();
    request.load(controller.signal).then(
      (answer) => {
        if (!controller.signal.aborted) setLoaded({ key: request.key, answer });
      },
      () => {
        if (!controller.signal.aborted) setLoaded({ key: request.key, answer: null });
      },
    );
    return () => controller.abort();
    // İstek yalnız konu değişince yenilenir. `request` her çizimde yeni nesnedir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, help]);

  if (!key) return { loading: false, answer: null };
  if (loaded?.key !== key) return { loading: true, answer: null };
  return { loading: false, answer: loaded.answer };
}

interface HelpPanelProps {
  open: boolean;
  /** `dock` içerikle yan yana durur. `drawer` tam ekran modal çekmecedir. */
  mode: HelpPanelMode;
  target: HelpTarget;
  selfHelp: boolean;
  onSelfHelpChange: (on: boolean) => void;
  onClose: () => void;
  /** Sık görevler. Kabuğun izin süzgecinden geçmiş hızlı eylemleridir. */
  tasks: QuickAction[];
}

/**
 * Yardım paneli. Kabuk paneli ilk açılışta yükler (`React.lazy`). Böylece panel ilk yüke girmez.
 * Panel bir kez yüklenince kapalıyken de DOM'da kalır. Böylece yön değişince açık panel, anahtar ve
 * odak korunur. Yalnız yerleşim öznitelikleri değişir; öğe yeniden kurulmaz.
 */
export const HelpPanel = forwardRef<HTMLElement, HelpPanelProps>(function HelpPanel(
  { open, mode, target, selfHelp, onSelfHelpChange, onClose, tasks },
  ref,
) {
  const titleId = useId();
  const switchLabelId = useId();
  const drawer = mode === 'drawer';
  const links = tasks.filter((a): a is QuickAction & { to: string } => !!a.to);
  const server = useServerHelp(target);
  const related = server.answer ? helpLinks(server.answer) : [];

  return (
    <aside
      ref={ref}
      id="shell-help"
      className="shell-help"
      data-mode={mode}
      hidden={!open}
      aria-labelledby={titleId}
      {...(drawer ? { role: 'dialog', 'aria-modal': true } : {})}
    >
      <div className="shell-help-head">
        <h2 id={titleId} className="shell-help-title">
          {t.help.title}
        </h2>
        <button
          type="button"
          className="shell-iconbtn"
          data-help-close=""
          aria-label={t.help.close}
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </button>
      </div>

      <div className="shell-help-body">
        {target.kind !== 'page' && (
          <section className="shell-help-sec" aria-labelledby={`${titleId}-field`}>
            <h3 id={`${titleId}-field`} className="shell-help-h">
              {target.label}
            </h3>
            <p className="shell-muted">{targetText(target, server)}</p>
          </section>
        )}

        {related.length > 0 && (
          <section className="shell-help-sec" aria-labelledby={`${titleId}-links`}>
            <h3 id={`${titleId}-links`} className="shell-help-h">
              {t.help.links}
            </h3>
            {/* Adres sunucudan gelir ve `safeHelpHref` denetiminden geçmiştir. */}
            <ul className="shell-help-tasks">
              {related.map((link) => (
                <li key={link.key}>
                  <a className="shell-item" href={link.href}>
                    <span>{t.help[link.key]}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="shell-help-sec" aria-labelledby={`${titleId}-page`}>
          <h3 id={`${titleId}-page`} className="shell-help-h">
            {t.help.pageHelp}
          </h3>
          <p className="shell-muted">{t.help.pageEmpty}</p>
        </section>

        <section className="shell-help-sec" aria-labelledby={`${titleId}-tasks`}>
          <h3 id={`${titleId}-tasks`} className="shell-help-h">
            {t.help.tasks}
          </h3>
          {links.length > 0 ? (
            <ul className="shell-help-tasks">
              {links.map((a) => (
                <li key={a.key}>
                  <Link className="shell-item" to={a.to} onClick={drawer ? onClose : undefined}>
                    <span>{a.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="shell-muted">{t.help.tasksEmpty}</p>
          )}
        </section>

        <section className="shell-help-sec shell-help-mode">
          <div className="shell-help-switch">
            <span id={switchLabelId} className="shell-help-h">
              {t.help.mode}
            </span>
            <Switch
              aria-labelledby={switchLabelId}
              aria-describedby={`${switchLabelId}-d`}
              checked={selfHelp}
              onChange={onSelfHelpChange}
            />
          </div>
          <p id={`${switchLabelId}-d`} className="shell-muted">
            {t.help.modeText}
          </p>
        </section>
      </div>
    </aside>
  );
});
