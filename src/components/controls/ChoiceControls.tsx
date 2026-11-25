import {
  Checkbox as AntCheckbox,
  Radio as AntRadio,
  Segmented as AntSegmented,
  Tag as AntTag,
} from 'antd';
import type {
  CheckboxProps,
  CheckboxRef,
  GetRef,
  RadioGroupProps,
  RadioProps,
  SegmentedProps,
  TagProps,
} from 'antd';
import { forwardRef } from 'react';
import type { ForwardedRef, ReactElement, RefAttributes } from 'react';

import { choice, classes, rowStyle } from './choice-shared';
import { Themed } from './ChoiceThemed';

export { Switch } from './Switch';

const CheckboxControl = forwardRef<CheckboxRef, CheckboxProps>(function Checkbox(
  { className, style, ...props },
  ref,
) {
  return (
    <Themed name="checkbox">
      <AntCheckbox
        {...props}
        ref={ref}
        className={classes('atonota-checkbox', className)}
        style={rowStyle(choice.checkbox.height, style)}
      />
    </Themed>
  );
});

/** antd's own group props, generic over the option value type. */
type CheckboxGroupProps<Value> = Parameters<typeof AntCheckbox.Group<Value>>[0];

const CheckboxGroup = forwardRef(function CheckboxGroup<Value>(
  { className, ...props }: CheckboxGroupProps<Value>,
  ref: ForwardedRef<HTMLDivElement>,
) {
  return (
    <Themed name="checkbox">
      <AntCheckbox.Group<Value>
        {...props}
        ref={ref}
        className={classes('atonota-checkbox-group', className)}
      />
    </Themed>
  );
}) as <Value = unknown>(
  props: CheckboxGroupProps<Value> & RefAttributes<HTMLDivElement>,
) => ReactElement;

export const Checkbox = Object.assign(CheckboxControl, { Group: CheckboxGroup });

type RadioRef = GetRef<typeof AntRadio>;

/** Radio is the card style (C3): a 32 px bordered row, see `.atonota-radio` in controls.css. */
const RadioControl = forwardRef<RadioRef, RadioProps>(function Radio(
  { className, style, ...props },
  ref,
) {
  return (
    <Themed name="radio">
      <AntRadio
        {...props}
        ref={ref}
        className={classes('atonota-radio', className)}
        style={rowStyle(choice.radio.height, style)}
      />
    </Themed>
  );
});

const RadioButton = forwardRef<RadioRef, RadioProps>(function RadioButton(
  { className, ...props },
  ref,
) {
  return (
    <Themed name="radio">
      <AntRadio.Button
        {...props}
        ref={ref}
        className={classes('atonota-radio-button', className)}
      />
    </Themed>
  );
});

const RadioGroup = forwardRef<HTMLDivElement, RadioGroupProps>(function RadioGroup(props, ref) {
  return (
    <Themed name="radio">
      <AntRadio.Group {...props} ref={ref} />
    </Themed>
  );
});

export const Radio = Object.assign(RadioControl, { Button: RadioButton, Group: RadioGroup });

/** Tabs are the segmented style (C3). */
export const Tabs = forwardRef(function Tabs<Value>(
  { className, ...props }: SegmentedProps<Value>,
  ref: ForwardedRef<HTMLDivElement>,
) {
  return (
    <Themed name="tabs">
      <AntSegmented<Value> {...props} ref={ref} className={classes('atonota-tabs', className)} />
    </Themed>
  );
}) as <Value = string | number>(
  props: SegmentedProps<Value> & RefAttributes<HTMLDivElement>,
) => ReactElement;

export const Tag = forwardRef<HTMLSpanElement, TagProps>(function Tag(
  { className, style, ...props },
  ref,
) {
  return (
    <Themed name="tag">
      <AntTag
        {...props}
        ref={ref}
        className={classes('atonota-tag', className)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          blockSize: choice.tag.height,
          // Pill shape (choice.tag.shape): half of the locked height.
          borderRadius: choice.tag.height / 2,
          gap: choice.tag.gap,
          paddingInline: choice.tag.paddingX,
          fontSize: choice.tag.fontSize,
          fontWeight: choice.tag.weight,
          ...style,
        }}
      />
    </Themed>
  );
});
