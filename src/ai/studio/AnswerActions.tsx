import { Actions } from '@ant-design/x';
import type { ActionsProps } from '@ant-design/x';
import type { KeyboardEvent } from 'react';
import { useLayoutEffect, useRef } from 'react';

type Item = ActionsProps['items'][number] & { label: string; pressed?: boolean };

/**
 * Accessible wrapper for the Ant Design X `Actions` component (U6).
 *
 * In `@ant-design/x` 1.6.1 the items render only as clickable `div` elements.
 * They have no roles, names or tab order. They do not work with the keyboard.
 * This wrapper gives each item a button role, a name and a tab order.
 * The Enter and Space keys also activate the item.
 */
export function AnswerActions({
  items,
  onClick,
}: {
  items: Item[];
  onClick: (key: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const nodes = ref.current?.querySelectorAll<HTMLElement>('.ant-actions-list-item');
    nodes?.forEach((node, index) => {
      const item = items[index];
      if (!item) return;
      node.setAttribute('role', 'button');
      node.setAttribute('tabindex', '0');
      node.setAttribute('aria-label', item.label);
      if (item.pressed === undefined) node.removeAttribute('aria-pressed');
      else node.setAttribute('aria-pressed', String(item.pressed));
    });
  });

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (!target.classList.contains('ant-actions-list-item')) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      target.click();
    }
  };

  return (
    <div ref={ref} onKeyDown={onKeyDown} className="ai-actions">
      <Actions
        items={items.map(({ pressed: _pressed, ...item }) => item)}
        onClick={({ key }) => onClick(key)}
      />
    </div>
  );
}
