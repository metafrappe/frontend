import { Drawer } from 'antd';
import type { DrawerProps } from 'antd';

import { useFocusReturn } from './focus-return';
import './dialog.css';

export type SidePanelProps = Omit<DrawerProps, 'afterOpenChange'> & { open: boolean };

/** Shared side panel. Closing returns focus to the opener. */
export function SidePanel({ rootClassName, open, ...props }: SidePanelProps) {
  const restore = useFocusReturn(open);
  return (
    <Drawer
      {...props}
      open={open}
      afterOpenChange={(visible) => {
        if (!visible) restore();
      }}
      rootClassName={rootClassName ? `atonota-dialog ${rootClassName}` : 'atonota-dialog'}
    />
  );
}
