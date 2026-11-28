import { Modal } from 'antd';
import type { ButtonProps, ModalProps } from 'antd';
import type { ReactNode } from 'react';

import { Button } from '../controls';
import { useEscapeWhileOpening, useFocusReturn } from './focus-return';
import { assertResultLabel } from './labels';
import './dialog.css';

interface BaseProps {
  open: boolean;
  title: ReactNode;
  children?: ReactNode;
  /** Closes the dialog without doing the action. Escape and the close icon call it too. */
  onCancel: () => void;
  width?: ModalProps['width'];
  /** Default true: a closed dialog leaves the page, so only one dialog footer exists. */
  destroyOnHidden?: boolean;
  className?: string;
  'data-testid'?: string;
}

interface WithActions extends BaseProps {
  /** Says the result, for example "Delete draft". "OK" alone fails in development. */
  confirmLabel: string;
  /** Says what closing does, for example "Keep editing". */
  cancelLabel: string;
  onConfirm: () => void;
  danger?: boolean;
  loading?: boolean;
  confirmButtonProps?: Omit<ButtonProps, 'onClick' | 'children' | 'type' | 'danger' | 'loading'> &
    Partial<Record<`data-${string}`, string>>;
}

interface WithoutActions extends BaseProps {
  /** The content brings its own buttons, for example a form. */
  confirmLabel?: undefined;
}

export type ActionDialogProps = WithActions | WithoutActions;

/**
 * Shared dialog. In a narrow area the buttons stack and wrap their text. In a short area
 * the body scrolls on its own and the last button stays on screen. Closing returns focus
 * to the opener, or to the neighbouring list item when the opener was removed.
 */
export function ActionDialog(props: ActionDialogProps) {
  const { open, title, children, onCancel, width, destroyOnHidden, className } = props;
  if (props.confirmLabel !== undefined) assertResultLabel(props.confirmLabel);
  const restore = useFocusReturn(open);
  useEscapeWhileOpening(open, onCancel);

  const footer =
    props.confirmLabel === undefined ? null : (
      <>
        <Button onClick={onCancel}>{props.cancelLabel}</Button>
        <Button
          {...props.confirmButtonProps}
          type="primary"
          danger={props.danger ?? false}
          loading={props.loading ?? false}
          onClick={props.onConfirm}
        >
          {props.confirmLabel}
        </Button>
      </>
    );

  return (
    <Modal
      open={open}
      title={title}
      onCancel={onCancel}
      footer={footer}
      {...(width === undefined ? {} : { width })}
      destroyOnHidden={destroyOnHidden ?? true}
      focusTriggerAfterClose={false}
      afterClose={restore}
      rootClassName={className ? `atonota-dialog ${className}` : 'atonota-dialog'}
      {...(props['data-testid'] ? { 'data-testid': props['data-testid'] } : {})}
    >
      {children}
    </Modal>
  );
}
