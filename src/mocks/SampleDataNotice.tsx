import { Typography } from 'antd';

import messages from './messages.json';

/** Shows a sample data notice on screen while the mock server is on (SZ-12). */
export function SampleDataNotice() {
  return (
    // K3: the text does not touch the screen edge. The margin is a spacing token (`--space-md`).
    <Typography.Paragraph
      role="status"
      type="secondary"
      style={{
        margin: 0,
        paddingBlock: 'var(--space-xxs)',
        paddingInline:
          'max(var(--space-md), env(safe-area-inset-left)) max(var(--space-md), env(safe-area-inset-right))',
      }}
    >
      {messages.tr.sample_data_notice}
    </Typography.Paragraph>
  );
}
