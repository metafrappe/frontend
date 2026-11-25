import { X } from '@phosphor-icons/react';
import { forwardRef, useId } from 'react';
import { Link } from 'react-router-dom';

import { Switch } from '@/components/controls';

import { t } from '../messages';
import type { QuickAction } from '../nav';
import type { HelpTarget } from './context';

export type HelpPanelMode = 'dock' | 'drawer';

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
 * Yardım paneli. Kapalıyken de DOM'da kalır. Böylece yön değişince açık panel, anahtar ve
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
        {target.kind === 'field' && (
          <section className="shell-help-sec" aria-labelledby={`${titleId}-field`}>
            <h3 id={`${titleId}-field`} className="shell-help-h">
              {target.label}
            </h3>
            <p className="shell-muted">{target.description?.trim() || t.help.fieldEmpty}</p>
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
