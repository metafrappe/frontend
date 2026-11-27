import { X } from '@phosphor-icons/react';
import type { KeyboardEvent, ReactNode, Ref } from 'react';
import { useId } from 'react';

import { t } from '../messages';

export const ASSIST_PANEL_ID = 'shell-assist';

interface AssistPanelProps {
  open: boolean;
  /** In the phone shell the panel is a full-height dialog that opens from the bottom. */
  compact: boolean;
  onClose: () => void;
  panelRef: Ref<HTMLDivElement>;
  closeRef: Ref<HTMLButtonElement>;
  /** Panel content. The content belongs to the `ai-studio` work; the shell only provides the slot. */
  children?: ReactNode;
}

/**
 * Assist panel slot. On wide screens it is the right-hand grid column and does not cover the content.
 * On phones it opens full height from the bottom. The focus dim is not used.
 */
export function AssistPanel({
  open,
  compact,
  onClose,
  panelRef,
  closeRef,
  children,
}: AssistPanelProps) {
  const titleId = useId();
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    e.preventDefault();
    onClose();
  };
  return (
    <div
      ref={panelRef}
      id={ASSIST_PANEL_ID}
      className="shell-assist"
      aria-labelledby={titleId}
      data-open={open ? 'true' : 'false'}
      // On wide screens a closed panel takes no space in the grid.
      hidden={!compact && !open}
      onKeyDown={onKeyDown}
      {...(compact ? { role: 'dialog', 'aria-modal': true } : { role: 'complementary' })}
    >
      <div className="shell-assist-head">
        <h2 id={titleId} className="shell-assist-title">
          {t.assist.title}
        </h2>
        <button
          ref={closeRef}
          type="button"
          className="shell-iconbtn"
          aria-label={t.assist.close}
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </button>
      </div>
      <div className="shell-assist-body">
        {children ?? <p className="shell-muted">{t.assist.empty}</p>}
      </div>
    </div>
  );
}
