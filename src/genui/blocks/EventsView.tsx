import { CheckCircle, Hourglass, ListChecks, XCircle } from '@phosphor-icons/react';
import { useId } from 'react';

import type { EventsBlock, ToolEventStatus } from '../types';
import { useGenuiStrings } from '../useGenuiStrings';

const ICON: Record<ToolEventStatus, typeof CheckCircle> = {
  done: CheckCircle,
  running: Hourglass,
  failed: XCircle,
};

/**
 * Araç olayı listesi. Olaylar sunucunun gönderdiği sırayla görünür.
 * Sahte ilerleme yoktur: yüzde ya da tahmini süre yazılmaz.
 */
export function EventsView({ block }: { block: EventsBlock }) {
  const text = useGenuiStrings();
  const id = useId();
  return (
    <div role="group" data-genui="events" className="genui-card genui-events" aria-labelledby={id}>
      <div className="genui-card-h">
        <ListChecks aria-hidden />
        <strong id={id}>{text.toolEvents}</strong>
      </div>
      <ul aria-labelledby={id}>
        {block.items.map((item) => {
          const Icon = ICON[item.status];
          return (
            <li key={item.id} className={`is-${item.status}`}>
              <Icon aria-hidden />
              <span>
                <code>{item.tool}</code> {item.summary}{' '}
                <span className="genui-event-state">{text.eventLabels[item.status]}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
