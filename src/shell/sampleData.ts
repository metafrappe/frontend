/**
 * Sample data. Person names use the Turkish "sample person" label. This is not real data.
 */
import type { Icon } from '@phosphor-icons/react';
import {
  Calculator,
  CheckSquare,
  Package,
  Receipt,
  Robot,
  ShoppingCart,
  Storefront,
  Users,
  Warehouse,
  CreditCard,
  FileText,
} from '@phosphor-icons/react';

import { routes } from './paths';

export interface NavLeaf {
  kind: 'link';
  id: string;
  label: string;
  to: string;
  icon: Icon;
  badge?: number;
  /** DocType names read by the page the link opens. See `permittedNav`. */
  requires?: readonly string[];
  /** If one of these types is readable, the link is hidden. See `permittedNav`. */
  excludes?: readonly string[];
}

export interface NavGroup {
  kind: 'group';
  id: string;
  label: string;
  icon: Icon;
  badge?: number;
  children: NavLeaf[];
}

export type NavEntry = NavLeaf | NavGroup;

export type AgentStatus = 'running' | 'idle' | 'error';

export interface Agent {
  id: string;
  name: string;
  task: string;
  status: AgentStatus;
  lastEvent: string;
  icon: Icon;
}

const leaf = (m: string, d: string, label: string, icon: Icon, badge?: number): NavLeaf => ({
  kind: 'link',
  id: `${m}-${d}`,
  label,
  to: routes.collection(m, d),
  icon,
  ...(badge === undefined ? {} : { badge }),
});

export const sampleNav: NavEntry[] = [
  {
    kind: 'group',
    id: 'satis',
    label: 'Satış',
    icon: ShoppingCart,
    badge: 12,
    children: [
      leaf('satis', 'teklif', 'Teklifler', FileText, 12),
      leaf('satis', 'siparis', 'Siparişler', Receipt),
      leaf('satis', 'musteri', 'Müşteriler', Users),
    ],
  },
  {
    kind: 'group',
    id: 'stok',
    label: 'Stok',
    icon: Package,
    children: [
      leaf('stok', 'urun', 'Ürünler', Storefront),
      leaf('stok', 'depo', 'Depolar', Warehouse),
    ],
  },
  {
    kind: 'group',
    id: 'muhasebe',
    label: 'Muhasebe',
    icon: Calculator,
    children: [
      leaf('muhasebe', 'fatura', 'Faturalar', Receipt),
      leaf('muhasebe', 'odeme', 'Ödemeler', CreditCard),
    ],
  },
  leaf('isler', 'gorev', 'Görevler', CheckSquare, 3),
];

export const sampleAgents: Agent[] = [
  {
    id: 'teklif',
    name: 'Teklif ajanı',
    task: 'Teklif taslaklarını hazırlar.',
    status: 'running',
    lastEvent: '2 dk önce',
    icon: Robot,
  },
  {
    id: 'stok',
    name: 'Stok ajanı',
    task: 'Az kalan ürünleri bildirir.',
    status: 'idle',
    lastEvent: '1 sa önce',
    icon: Robot,
  },
  {
    id: 'tahsilat',
    name: 'Tahsilat ajanı',
    task: 'Geciken ödemeleri listeler.',
    status: 'error',
    lastEvent: '15 dk önce',
    icon: Robot,
  },
];

/** The test page's sample workspaces. Not shown in the live panel. */
export const sampleWorkspaces = [
  { id: 'a', name: 'Örnek Şirket A', note: 'Ana çalışma alanı' },
  { id: 'b', name: 'Örnek Şirket B', note: 'Deneme çalışma alanı' },
  { id: 'c', name: 'Örnek Şirket C', note: 'Arşiv' },
];

export const sampleUser = { name: 'Örnek Kişi', role: 'Yönetici', initials: 'ÖK' };

/** The test page's sample credit. Not shown in the live panel. */
export const sampleCredit = { used: 6200, total: 10000 };

/** The test page's sample quick actions. The request goes to the assistant. */
export const samplePrompts = [
  { key: 'ozet', label: 'Günün özeti', prompt: 'Günün özeti' },
  { key: 'teklif', label: 'Yeni teklif', prompt: 'Yeni teklif' },
  { key: 'gecikme', label: 'Gecikenler', prompt: 'Gecikenler' },
];

export type RowStatus = 'Taslak' | 'Gönderildi' | 'Onaylandı' | 'Reddedildi';

export interface SampleRow {
  name: string;
  title: string;
  party: string;
  status: RowStatus;
  amount: number;
  date: string;
}

const statuses: RowStatus[] = ['Taslak', 'Gönderildi', 'Onaylandı', 'Reddedildi'];

export function sampleRows(doctype: string, total = 24): SampleRow[] {
  const prefix = doctype.slice(0, 3).toUpperCase();
  return Array.from({ length: total }, (_, i) => {
    const n = i + 1;
    return {
      name: `${prefix}-${String(n).padStart(4, '0')}`,
      title: `Örnek kayıt ${n}`,
      party: `Örnek Kişi ${(n % 7) + 1}`,
      status: statuses[n % statuses.length] ?? 'Taslak',
      amount: 1250 * ((n % 9) + 1),
      date: `2026-11-${String((n % 28) + 1).padStart(2, '0')}`,
    };
  });
}

export function findLeaf(module: string, doctype: string): NavLeaf | undefined {
  for (const e of sampleNav) {
    if (e.kind === 'link' && e.id === `${module}-${doctype}`) return e;
    if (e.kind === 'group') {
      const c = e.children.find((x) => x.id === `${module}-${doctype}`);
      if (c) return c;
    }
  }
  return undefined;
}

export function findGroup(module: string): NavGroup | undefined {
  return sampleNav.find((e): e is NavGroup => e.kind === 'group' && e.id === module);
}
