// G-139 tur ilerlemesi depoları. Sunucu deposu `@/api/tour-client` içindedir.
// Tarayıcı deposu yalnız deneme sayfası içindir. Anahtar kullanıcı ve tur kimliğini taşır.
import { describe, expect, it } from 'vitest';

import type { TourProgress } from './model';
import { createBrowserTourStore, createMemoryTourStore } from './store';

const value: TourProgress = {
  tour_id: 'leave-application',
  version: 1,
  status: 'snoozed',
  current_step: 'reason',
  seen_steps: ['intro', 'reason'],
};

describe('tur depoları', () => {
  it('bellek deposu ilk ziyarette null, kayıttan sonra aynı değeri döner', async () => {
    const store = createMemoryTourStore();
    await expect(store.load('leave-application')).resolves.toBeNull();
    await store.save(value);
    await expect(store.load('leave-application')).resolves.toEqual(value);
  });

  it('bellek deposu sunucu gibi birleştirir: görülen adımlar silinmez', async () => {
    const store = createMemoryTourStore();
    await store.save(value);
    await store.save({ ...value, seen_steps: ['save'] });
    await expect(store.load('leave-application')).resolves.toMatchObject({
      seen_steps: ['intro', 'reason', 'save'],
    });
    await store.save({ ...value, seen_steps: [] }, { restart: true });
    await expect(store.load('leave-application')).resolves.toMatchObject({ seen_steps: [] });
  });

  it('tarayıcı deposu kullanıcıları birbirinden ayırır', async () => {
    const storage = new Map<string, string>();
    const backing = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, item: string) => void storage.set(key, item),
    };
    const first = createBrowserTourStore(backing, 'first@example.test');
    const second = createBrowserTourStore(backing, 'second@example.test');
    await first.save(value);
    await expect(first.load('leave-application')).resolves.toEqual(value);
    await expect(second.load('leave-application')).resolves.toBeNull();
  });

  it('tarayıcı deposu bozuk kaydı yok sayar', async () => {
    const backing = { getItem: () => '{bozuk', setItem: () => undefined };
    await expect(
      createBrowserTourStore(backing, 'first@example.test').load('leave-application'),
    ).resolves.toBeNull();
  });
});
