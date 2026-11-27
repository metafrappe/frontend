import { Drawer } from 'antd';
import type { DrawerProps } from 'antd';

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
