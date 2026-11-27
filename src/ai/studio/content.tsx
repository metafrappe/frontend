import type { PromptProps } from '@ant-design/x';
import { Lightning, Package, ChartBar, Sparkle } from '@phosphor-icons/react';

/** Categorised suggestions in the empty state (Prompts, nested). */
export const WELCOME_PROMPTS: PromptProps[] = [
  {
    key: 'report',
    label: 'Rapor ve özet',
    icon: <ChartBar aria-hidden />,
    children: [
      {
        key: 'report-week',
        label: 'Bu haftanın satış özetini çıkar',
        icon: <Sparkle className="ai-spark" aria-hidden />,
      },
      {
        key: 'report-month',
        label: 'Geçen ayla satışları karşılaştır',
        icon: <Sparkle className="ai-spark" aria-hidden />,
      },
    ],
  },
  {
    key: 'orders',
    label: 'Sipariş ve otomasyon',
    icon: <Package aria-hidden />,
    children: [
      {
        key: 'orders-late',
        label: 'Geciken siparişleri bul',
        icon: <Sparkle className="ai-spark" aria-hidden />,
      },
      {
        key: 'orders-rule',
        label: 'Stok uyarısı için otomasyon kur',
        icon: <Lightning aria-hidden />,
      },
    ],
  },
];

/** "/" commands (Suggestion). */
export const SLASH_COMMANDS = [
  {
    label: '/rapor: Satış özeti',
    value: 'Bu haftanın satış özetini çıkar',
    icon: <ChartBar aria-hidden />,
  },
  {
    label: '/siparis: Geciken siparişler',
    value: 'Geciken siparişleri bul',
    icon: <Package aria-hidden />,
  },
  {
    label: '/otomasyon: Stok kuralı',
    value: 'Stok uyarısı için otomasyon kur',
    icon: <Lightning aria-hidden />,
  },
];

/** Text AI Studio shows when no model gateway connection is set up. No mock agent runs. */
export const NOT_CONNECTED = {
  title: 'AI Studio bağlantısı kurulmadı',
  body: 'Bu panel henüz model geçidine bağlı değil. Bu yüzden asistan yanıt veremez.',
  next: 'Bağlantı kurulunca sohbet bu sayfada açılır.',
};
