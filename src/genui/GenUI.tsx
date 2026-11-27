import './genui.css';

import { ConfigProvider } from 'antd';
import type { ComponentType } from 'react';

import { JsonView } from './blocks/JsonView';
import { GENUI_REGISTRY, type BlockProps } from './registry';
import { showsRawJson } from './schema';
import type { GenUIActionHandler, GenUIBlock, GenUIDecisions, KnownBlock } from './types';
import { useGenuiFocusTheme, useGenuiVars } from './useGenuiVars';

export interface GenUIProps {
  blocks: GenUIBlock[];
  /** Returns `true` if the chat accepts the action (U4). */
  onAction: GenUIActionHandler;
  /** `true` while the chat awaits a reply. Confirm and form buttons are disabled. */
  busy?: boolean;
  /** Decisions derived from chat history. Read by block ID. */
  decisions?: GenUIDecisions;
}

export function GenUI({ blocks, onAction, busy = false, decisions = {} }: GenUIProps) {
  const vars = useGenuiVars();
  const focusTheme = useGenuiFocusTheme();
  if (blocks.length === 0) return null;
  return (
    <ConfigProvider theme={focusTheme}>
      <div className="genui" style={vars}>
        {blocks.map((block, index) => {
          // Unregistered blocks are not drawn. Only malformed first-six blocks show as JSON.
          if (block.type === 'unknown') {
            return showsRawJson(block.raw) ? <JsonView key={index} raw={block.raw} /> : null;
          }
          const View = GENUI_REGISTRY[block.type] as ComponentType<BlockProps<KnownBlock>>;
          const decided =
            block.type === 'confirm' || block.type === 'form' ? decisions[block.id] : undefined;
          return (
            <View key={index} block={block} onAction={onAction} busy={busy} decided={decided} />
          );
        })}
      </div>
    </ConfigProvider>
  );
}

/** While streaming, a skeleton shows in place of the blocks (U5). */
export function GenUISkeleton() {
  const vars = useGenuiVars();
  return (
    <div className="genui genui-skel" style={vars} aria-hidden>
      <i />
      <i />
      <i />
    </div>
  );
}
