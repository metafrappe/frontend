import { Drawer } from 'antd';
import type { DrawerProps } from 'antd';
import { useEffect } from 'react';

import { useEscapeWhileOpening, useFocusReturn } from './focus-return';
import './dialog.css';

export type SidePanelProps = Omit<DrawerProps, 'afterOpenChange' | 'onClose' | 'open'> & {
  open: boolean;
  onClose: () => void;
};

/** Shared side panel. Closing returns focus to the opener. */
export function SidePanel({ rootClassName, open, onClose, ...props }: SidePanelProps) {
  const restore = useFocusReturn(open);
  useEscapeWhileOpening(open, onClose);

  // The panel can close before its open step ends, for example on a quick Escape.
  // Drawer then never calls afterOpenChange(false) and focus falls to the page body.
  // So focus also returns one frame after closing, unless the user already moved it elsewhere.
  useEffect(() => {
    if (open) return undefined;
    const frame = requestAnimationFrame(() => {
      const active = document.activeElement;
      if (!active || active === document.body || active.closest('.ant-drawer')) restore();
    });
    return () => cancelAnimationFrame(frame);
  }, [open, restore]);

  return (
    <Drawer
      {...props}
      open={open}
      onClose={onClose}
      afterOpenChange={(visible) => {
        if (!visible) restore();
      }}
      rootClassName={rootClassName ? `atonota-dialog ${rootClassName}` : 'atonota-dialog'}
    />
  );
}
