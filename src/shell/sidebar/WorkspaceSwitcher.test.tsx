import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { sampleWorkspaces } from '../sampleData';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';

/** Sample workspaces of the demo page. More than one workspace builds a dropdown. */
const data = { items: sampleWorkspaces, current: 'a' };

/**
 * A closing list is semantically hidden at once (Linux WebKit flakiness, 23 November 2026).
 * The closing animation depends on browser frames. On a slow device frames can lag by seconds.
 * While the animation runs, the list must be closed to screen readers and the keyboard.
 */
describe('WorkspaceSwitcher kapanan liste', () => {
  it('kapanınca liste aria-hidden ve inert olur', () => {
    render(
      <div className="shell">
        <WorkspaceSwitcher rail={false} data={data} />
      </div>,
    );
    const button = screen.getByRole('button', { name: /Örnek Şirket A/ });
    act(() => button.focus());
    fireEvent.keyDown(button, { key: 'Enter' });
    const menu = screen.getByRole('menu', { name: 'Çalışma alanları' });
    expect(menu.closest('[aria-hidden="true"]')).toBeNull();
    expect(menu.closest('[inert]')).toBeNull();

    fireEvent.keyDown(menu, { key: 'Escape' });

    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(menu.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(menu.closest('[inert]')).not.toBeNull();
    expect(screen.queryByRole('menu', { name: 'Çalışma alanları' })).toBeNull();
  });
});

/**
 * Review 1, K-3: after a mouse selection, focus does not fall to the page body.
 * The closing list becomes `inert` at once. If focus is in the list, it first returns to the trigger button.
 * If focus is not in the list, focus is left alone.
 */
describe('WorkspaceSwitcher fareyle seçim', () => {
  function openWithMouse() {
    render(
      <div className="shell">
        <button type="button">Dış düğme</button>
        <WorkspaceSwitcher rail={false} data={data} />
      </div>,
    );
    const button = screen.getByRole('button', { name: /Örnek Şirket A/ });
    fireEvent.click(button);
    const menu = screen.getByRole('menu', { name: 'Çalışma alanları' });
    const item = screen.getAllByRole('menuitem')[1];
    if (!item) throw new Error('Listede ikinci öğe yok');
    return { button, menu, item };
  }

  it('odak listedeyse seçimden sonra tetik düğmesine döner', () => {
    const { button, item } = openWithMouse();
    // Chromium focuses the clicked item.
    act(() => item.focus());
    expect(document.activeElement).toBe(item);

    fireEvent.click(item);

    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(document.activeElement).toBe(button);
  });

  it('odak listede değilse seçim odağa dokunmaz', () => {
    const { button, item } = openWithMouse();
    const outside = screen.getByRole('button', { name: 'Dış düğme' });
    act(() => outside.focus());

    fireEvent.click(item);

    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(document.activeElement).toBe(outside);
  });
});
