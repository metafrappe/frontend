import { Popconfirm } from 'antd';
import type { PopconfirmProps } from 'antd';
import { useState, type ReactElement, type ReactNode } from 'react';

import { useFocusReturn } from './focus-return';
import { assertResultLabel } from './labels';
import './dialog.css';

export interface ConfirmPopoverProps {
  title: ReactNode;
  description?: ReactNode;
  /** Says the result, for example "Remove link". "OK" alone fails in development. */
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  danger?: boolean;
  placement?: PopconfirmProps['placement'];
  children: ReactElement;
}

/** Shared short confirm. Buttons stack in a narrow area. Closing returns focus to the trigger. */
export function ConfirmPopover({
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  danger,
  placement,
  children,
}: ConfirmPopoverProps) {
  assertResultLabel(confirmLabel);
  const [open, setOpen] = useState(false);
  const restore = useFocusReturn(open);

  return (
    <Popconfirm
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) requestAnimationFrame(restore);
      }}
      title={title}
      description={description}
      okText={confirmLabel}
      cancelText={cancelLabel}
      okButtonProps={{ danger: danger ?? false, className: 'atonota-button' }}
      cancelButtonProps={{ className: 'atonota-button' }}
      onConfirm={() => {
        setOpen(false);
        onConfirm();
        requestAnimationFrame(restore);
      }}
      onCancel={() => {
        setOpen(false);
        requestAnimationFrame(restore);
      }}
      {...(placement ? { placement } : {})}
      rootClassName="atonota-dialog atonota-popconfirm"
    >
      {children as ReactNode}
    </Popconfirm>
  );
}
