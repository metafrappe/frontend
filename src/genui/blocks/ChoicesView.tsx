import { Prompts } from '@ant-design/x';
import { LocalizedXProvider } from '@/app/locale/LocalizedXProvider';
import { Sparkle } from '@phosphor-icons/react';

import { useGenuiStrings } from '../useGenuiStrings';
import type { ChoicesBlock, GenUIActionHandler } from '../types';

export function ChoicesView({
  block,
  onAction,
}: {
  block: ChoicesBlock;
  onAction: GenUIActionHandler;
}) {
  const text = useGenuiStrings();
  return (
    <LocalizedXProvider>
      <section data-genui="choices" className="genui-choices" aria-label={text.suggestions}>
        <Prompts
          wrap
          items={block.items.map((label, index) => ({
            key: String(index),
            icon: <Sparkle className="ai-spark" aria-hidden />,
            label,
          }))}
          onItemClick={({ data }) => {
            if (typeof data.label === 'string') onAction({ kind: 'ask', text: data.label });
          }}
        />
      </section>
    </LocalizedXProvider>
  );
}
