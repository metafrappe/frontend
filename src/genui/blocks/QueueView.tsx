import { useId } from 'react';

import type { QueueBlock } from '../types';
import { useGenuiStrings } from '../useGenuiStrings';
import { RISK_TONE } from './SurfaceLabels';

/** Karar kuyruğu: kullanıcının kararını bekleyen işler. Salt okunurdur. */
export function QueueView({ block }: { block: QueueBlock }) {
  const text = useGenuiStrings();
  const id = useId();
  const count = block.items.length;
  return (
    <div role="group" data-genui="queue" className="genui-card genui-queue" aria-labelledby={id}>
      <h3 id={id} className="genui-queue-h">
        {count > 0 ? text.queue.count(count) : text.queue.none}
      </h3>
      {count === 0 ? (
        <p className="genui-muted-text">{text.queue.empty}</p>
      ) : (
        <ul aria-label={text.queue.list}>
          {block.items.map((item) => (
            <li key={item.id}>
              <span className="genui-queue-title">{item.title}</span>
              {item.detail && <span className="genui-muted-text">{item.detail}</span>}
              <span className={`genui-badge is-${RISK_TONE[item.risk]}`}>
                {text.riskLabels[item.risk]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
