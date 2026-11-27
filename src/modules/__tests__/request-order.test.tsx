// Next page on a list screen (AJA-1773). Each record shows once, even when the next page is
// triggered twice and the server shifts the page by one record.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import PermissionLog from '../administration/PermissionLog';
import { ModuleProvider, type AdminClient } from '../runtime';

afterEach(cleanup);

function entry(index: number) {
  return {
    name: `LOG-${String(index).padStart(3, '0')}`,
    changed_at: '2026-11-25 10:00:00',
    changed_by: 'ornek.yonetici@example.invalid',
    for_doctype: 'DocType',
    for_document: `Belge ${index}`,
    reference_type: 'Custom DocPerm',
    reference: null,
    status: 'Updated',
    changes: {},
  };
}

it('shows each record once when the next page is triggered twice', async () => {
  // A new entry arrives between the two reads. The second page starts one record earlier.
  const listPermissionLogs = vi.fn(async ({ start }: { start: number }) => {
    const from = start === 0 ? 1 : start;
    const logs = Array.from({ length: 20 }, (_, index) => entry(from + index));
    return { logs, start, page_length: 20, has_more: start === 0 };
  });
  const admin = { listPermissionLogs } as unknown as AdminClient;
  render(
    <ModuleProvider
      value={{ tenant: 'kurum-a', user: 'yonetici', mode: 'example', client: { admin } }}
    >
      <PermissionLog />
    </ModuleProvider>,
  );
  const more = await screen.findByRole('button', { name: 'Daha eski kayıtlar' });
  fireEvent.click(more);
  fireEvent.click(more);
  await screen.findByText(/Belge 39/);
  const list = screen.getByRole('list');
  const names = within(list)
    .getAllByText(/^DocType: Belge \d+/)
    .map((node) => node.textContent);
  expect(names).toHaveLength(new Set(names).size);
  expect(names).toHaveLength(39);
});
