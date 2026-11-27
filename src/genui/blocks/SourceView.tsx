import { FileText } from '@phosphor-icons/react';
import { useId } from 'react';
import { useMessage } from '@/app/locale';

import type { SourceBlock } from '../types';
import { SourceList } from './SourceList';

/** Kaynak kartı: kaynağın adı ve bağlantısı. */
export function SourceView({ block }: { block: SourceBlock }) {
  const id = useId();
  const m = useMessage();
  return (
    <div role="group" data-genui="source" className="genui-source" aria-labelledby={id}>
      <FileText aria-hidden />
      <div>
        <strong id={id}>{m('genui.source.title')}</strong>
        <SourceList items={block.items} />
      </div>
    </div>
  );
}
