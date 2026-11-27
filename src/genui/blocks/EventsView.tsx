import { CheckCircle, Hourglass, ListChecks, XCircle } from '@phosphor-icons/react';
import { useId } from 'react';

import type { EventsBlock, ToolEventStatus } from '../types';
import { EVENT_LABEL } from './SurfaceLabels';

const ICON: Record<ToolEventStatus, typeof CheckCircle> = {
  done: CheckCircle,
  running: Hourglass,
  failed: XCircle,
};

/**
 * Tool event list. Events show in the order the server sent them.
 * No fake progress: no percentage or estimated time is shown.
 */
export function EventsView({ block }: { block: EventsBlock }) {
  const id = useId();
  return (
    <div role="group" data-genui="events" className="genui-card genui-events" aria-labelledby={id}>
      <div className="genui-card-h">
        <ListChecks aria-hidden />
        <strong id={id}>Araç olayları</strong>
      </div>
      <ul aria-labelledby={id}>
        {block.items.map((item) => {
          const Icon = ICON[item.status];
          return (
            <li key={item.id} className={`is-${item.status}`}>
              <Icon aria-hidden />
              <span>
                <code>{item.tool}</code> {item.summary}{' '}
                <span className="genui-event-state">{EVENT_LABEL[item.status]}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
