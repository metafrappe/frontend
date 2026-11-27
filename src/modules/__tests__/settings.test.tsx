// Kiracı ayarları ve marka ekranı (G-97 parça 1, AJA-2491).
// Ayar formları elle yazılmaz. Formu kayıt katmanı (`RecordView`) türün şemasından çizer.
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ApiClient } from '@/api';
import type * as RecordModule from '@/views/record';
import type { RecordViewProps } from '@/views/record';

import { moduleRegistrations } from '../registry';
import { ModuleProvider, type ModuleClient } from '../runtime';

const seen: RecordViewProps[] = [];

vi.mock('@/views/record', async (importOriginal) => ({
  ...(await importOriginal<typeof RecordModule>()),
  RecordView: (props: RecordViewProps) => {
    seen.push(props);
    return (
      <p>{`${props.doctype}|${props.name ?? ''}|${props.title ?? ''}|${props.locale ?? ''}`}</p>
    );
  },
}));

const SITE = 'https://kiraci.example.test';

function records(): Pick<ApiClient, 'frappeDocument'> {
  return { frappeDocument: vi.fn<ApiClient['frappeDocument']>() };
}

async function openPage(path: string, client: ModuleClient, locale: 'tr' | 'en' = 'tr') {
  const registration = moduleRegistrations.find((m) => m.path === path);
  if (!registration) throw new Error(`kayıt yok: ${path}`);
  const { default: Page } = await registration.load();
  render(
    <ModuleProvider
      value={{ tenant: SITE, user: 'admin@kiraci.test', mode: 'live', locale, client }}
    >
      <Page />
    </ModuleProvider>,
  );
}

afterEach(() => {
  cleanup();
  seen.length = 0;
});

describe('Kiracı ayarları (G-97)', () => {
  it.each([
    ['/settings', 'Tenant Settings', 'Genel ayarlar'],
    ['/settings/branding', 'Tenant Branding', 'Marka'],
    ['/settings/hr', 'HR Settings', 'İK ayarları'],
  ])('%s sayfası %s türünü kayıt formuyla açar', async (path, doctype, title) => {
    await openPage(path, { records: records() });
    expect(await screen.findByText(`${doctype}|${doctype}|${title}|tr`)).toBeInTheDocument();
    // Tek kayıtlı ayar türünde kaydın adı türün adıdır (Frappe Single DocType).
    expect(seen.at(-1)?.adapter).toBeDefined();
  });

  it('sayfa başlığı seçili dile göre değişir', async () => {
    await openPage('/settings/branding', { records: records() }, 'en');
    expect(
      await screen.findByText('Tenant Branding|Tenant Branding|Branding|en'),
    ).toBeInTheDocument();
  });

  it('kayıt istemcisi yoksa form açılmaz ve bağlantı eksikliği yazılır', async () => {
    await openPage('/settings', {});
    expect(await screen.findByRole('alert')).toHaveTextContent('Ayar bağlantısı kurulmadı');
    expect(seen).toHaveLength(0);
  });

  it('ayar sayfaları bayi hesabında ve yetkisiz kullanıcıda kapalıdır', () => {
    for (const path of ['/settings', '/settings/branding', '/settings/hr']) {
      const registration = moduleRegistrations.find((m) => m.path === path);
      expect(registration?.requires?.length).toBe(1);
      expect(registration?.excludes).toContain('Reseller Customer Link');
    }
  });
});
