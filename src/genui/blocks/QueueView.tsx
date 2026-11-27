import { useId } from 'react';

import type { QueueBlock } from '../types';
import { RISK_LABEL, RISK_TONE } from './SurfaceLabels';

/** Decision queue: items waiting for the user's decision. Read-only. */
export function QueueView({ block }: { block: QueueBlock }) {
  const id = useId();
  const count = block.items.length;
  return (
    <div role="group" data-genui="queue" className="genui-card genui-queue" aria-labelledby={id}>
      <h3 id={id} className="genui-queue-h">
        {count > 0 ? `Kararınızı bekleyen ${count} iş var` : 'Bekleyen karar yok'}
      </h3>
      {count === 0 ? (
        <p className="genui-muted-text">Kararınızı bekleyen iş yok.</p>
      ) : (
        <ul aria-label="Bekleyen kararlar">
          {block.items.map((item) => (
            <li key={item.id}>
              <span className="genui-queue-title">{item.title}</span>
              {item.detail && <span className="genui-muted-text">{item.detail}</span>}
              <span className={`genui-badge is-${RISK_TONE[item.risk]}`}>
                {RISK_LABEL[item.risk]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
