import { ConfigProvider, Switch as AntSwitch } from 'antd';
import type { SwitchProps, ThemeConfig } from 'antd';
import { forwardRef } from 'react';

import { primary } from '@/design';

import { choice, classes, rowStyle } from './choice-shared';
import { Themed } from './ChoiceThemed';

type SwitchRef = HTMLButtonElement;

/** Source `choice.switch.showText`: the track shows its state. Callers may pass their own text. */
const switchText = choice.switch.showText
  ? { checkedChildren: 'Açık', unCheckedChildren: 'Kapalı' }
  : {};

/**
 * The checked track is the solid primary color in both themes, so its text uses the light
 * primary text (black 85 %, source `primary.light`). The unchecked text is set in controls.css.
 */
const switchTheme: ThemeConfig = {
  // Squared handle radius: the source example draws 3 px, equal to the source track padding.
  token: { borderRadiusXS: choice.switch.padding },
  components: { Switch: { colorTextLightSolid: primary.light.text } },
};

/**
 * The 24 px track sits in the locked 28 px row (`choice.switch.height` / `trackHeight`).
 * `choice.switch.squared`: the track uses the control radius (`.atonota-switch-squared`).
 */
export const Switch = forwardRef<SwitchRef, SwitchProps>(function Switch(props, ref) {
  return (
    <Themed name="switch">
      <ConfigProvider theme={switchTheme}>
        <span
          className={classes('atonota-switch', choice.switch.squared && 'atonota-switch-squared')}
          // The label keeps the source size (14 px); it must not inherit the 16 px body text.
          style={rowStyle(choice.switch.height, { fontSize: choice.switch.labelSize })}
        >
          <AntSwitch {...switchText} {...props} ref={ref} />
        </span>
      </ConfigProvider>
    </Themed>
  );
});
