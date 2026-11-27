import {
  ConfigProvider,
  Input as AntInput,
  InputNumber as AntInputNumber,
  Select as AntSelect,
} from 'antd';
import type { InputNumberProps, InputProps, InputRef, SelectProps } from 'antd';
import { forwardRef, useCallback, useEffect, useRef } from 'react';
import type {
  ComponentProps,
  ComponentRef,
  ForwardedRef,
  ReactElement,
  ReactNode,
  RefAttributes,
  RefObject,
} from 'react';

import './controls.css';
import { useTextRules } from './text-rules';

const InputField = forwardRef<InputRef, InputProps>(function Input(
  { className, suffix, maxLength, showCount, count, onPressEnter, onKeyDown, ...props },
  ref,
) {
  const rules = useTextRules<HTMLInputElement>({
    maxLength,
    showCount,
    count,
    onPressEnter,
    onKeyDown,
    'aria-describedby': props['aria-describedby'],
  });
  return (
    <AntInput
      {...props}
      {...rules}
      ref={ref}
      className={['atonota-input', className].filter(Boolean).join(' ')}
      suffix={suffix ?? <span className="hit-sfx" aria-hidden="true" />}
    />
  );
});

type TextAreaProps = ComponentProps<typeof AntInput.TextArea>;
type TextAreaRef = ComponentRef<typeof AntInput.TextArea>;

/** The text area follows the same text rules as the input (AJA-1764). */
const TextAreaField = forwardRef<TextAreaRef, TextAreaProps>(function TextArea(
  { maxLength, showCount, count, onPressEnter, onKeyDown, ...props },
  ref,
) {
  const rules = useTextRules<HTMLTextAreaElement>({
    maxLength,
    showCount,
    count,
    onPressEnter,
    onKeyDown,
    'aria-describedby': props['aria-describedby'],
  });
  return <AntInput.TextArea {...props} {...rules} ref={ref} />;
});

Object.assign(InputField, {
  Group: AntInput.Group,
  Search: AntInput.Search,
  TextArea: TextAreaField,
  Password: AntInput.Password,
  OTP: AntInput.OTP,
});

export const Input = InputField as typeof AntInput;

type NumberRef = ComponentRef<typeof AntInputNumber>;
type NumberValue = NonNullable<InputNumberProps['value']>;

export const InputNumber = forwardRef(function InputNumber<T extends NumberValue>(
  { className, ...props }: InputNumberProps<T>,
  ref: ForwardedRef<NumberRef>,
) {
  const { componentDisabled } = ConfigProvider.useConfig();
  const disabled = props.disabled ?? componentDisabled;
  const detach = useRef<() => void>();
  const setInput = useCallback(
    (input: NumberRef | null) => {
      detach.current?.();
      detach.current = undefined;

      if (input && !disabled) {
        const { nativeElement } = input;
        const focusExpandedArea = (event: PointerEvent) => {
          if (event.target === nativeElement) {
            event.preventDefault();
            input.focus();
          }
        };
        nativeElement.setAttribute('data-hit-target', '');
        nativeElement.addEventListener('pointerdown', focusExpandedArea);
        detach.current = () => {
          nativeElement.removeEventListener('pointerdown', focusExpandedArea);
          nativeElement.removeAttribute('data-hit-target');
        };
      }

      if (typeof ref === 'function') ref(input);
      else if (ref) ref.current = input;
    },
    [disabled, ref],
  );

  return (
    <AntInputNumber<T>
      {...props}
      ref={setInput}
      className={['atonota-number', className].filter(Boolean).join(' ')}
    />
  );
}) as <T extends NumberValue = NumberValue>(
  props: InputNumberProps<T> & RefAttributes<NumberRef>,
) => ReactElement;

type SelectRef = ComponentRef<typeof AntSelect>;
type SelectOption = NonNullable<SelectProps['options']>[number];

const attachedPlacements: SelectProps['builtinPlacements'] = {
  bottomLeft: { points: ['tl', 'bl'], offset: [0, 0], overflow: { adjustX: true, adjustY: true } },
  bottomRight: { points: ['tr', 'br'], offset: [0, 0], overflow: { adjustX: true, adjustY: true } },
  topLeft: { points: ['bl', 'tl'], offset: [0, 0], overflow: { adjustX: true, adjustY: true } },
  topRight: { points: ['br', 'tr'], offset: [0, 0], overflow: { adjustX: true, adjustY: true } },
};

function SelectPopup({ children, select }: { children: ReactNode; select: RefObject<SelectRef> }) {
  const content = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = select.current?.nativeElement;
    const popup = content.current?.closest('.atonota-select-popup');
    if (!element || !popup) return;

    function syncSide() {
      element?.toggleAttribute('data-popup-above', /placement-top/.test(popup?.className ?? ''));
    }

    const observer = new MutationObserver(syncSide);
    observer.observe(popup, { attributeFilter: ['class'] });
    syncSide();
    return () => {
      observer.disconnect();
      element.removeAttribute('data-popup-above');
    };
  }, [select]);

  return <div ref={content}>{children}</div>;
}

const SelectField = forwardRef(function Select<Value, Option extends SelectOption>(
  {
    className,
    classNames,
    popupClassName,
    dropdownClassName,
    popupRender,
    dropdownRender,
    ...props
  }: SelectProps<Value, Option>,
  ref: ForwardedRef<SelectRef>,
) {
  const select = useRef<SelectRef | null>(null);
  const setSelect = useCallback(
    (value: SelectRef | null) => {
      select.current = value;
      if (typeof ref === 'function') ref(value);
      else if (ref) ref.current = value;
    },
    [ref],
  );

  return (
    <AntSelect<Value, Option>
      builtinPlacements={attachedPlacements}
      transitionName="atonota-popup-motion"
      {...props}
      ref={setSelect}
      popupRender={(menu) => (
        <SelectPopup select={select}>
          {popupRender ? popupRender(menu) : dropdownRender ? dropdownRender(menu) : menu}
        </SelectPopup>
      )}
      className={['atonota-select', className].filter(Boolean).join(' ')}
      classNames={{
        ...classNames,
        popup: {
          ...classNames?.popup,
          root: [
            'atonota-select-popup atonota-control-popup',
            classNames?.popup?.root ?? popupClassName ?? dropdownClassName,
          ]
            .filter(Boolean)
            .join(' '),
        },
      }}
    />
  );
}) as <Value = unknown, Option extends SelectOption = SelectOption>(
  props: SelectProps<Value, Option> & RefAttributes<SelectRef>,
) => ReactElement;

Object.assign(SelectField, {
  Option: AntSelect.Option,
  OptGroup: AntSelect.OptGroup,
  SECRET_COMBOBOX_MODE_DO_NOT_USE: AntSelect.SECRET_COMBOBOX_MODE_DO_NOT_USE,
});

export const Select = SelectField as typeof SelectField &
  Pick<typeof AntSelect, 'Option' | 'OptGroup' | 'SECRET_COMBOBOX_MODE_DO_NOT_USE'>;
