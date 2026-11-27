/**
 * Mock agent server. Once `src/mocks/` is ready, the server there will be used.
 *
 * It produces the same SSE events as the real server. The UI clearly labels this
 * reply as "Sahte sunucu" (mock server) (AX-7). It performs no real operations.
 */
import { encodeAgentEvent } from './events';
import type { AllowedTool } from './tools';
import type { AgentEvent, AgentRequest, AgentSource, AgentTransport } from './types';

/** On-screen name of the mock server (AX-7). */
export const MOCK_SOURCE: AgentSource = { label: 'Sahte sunucu', simulated: true };

/** Tool ID and the title shown on screen. */
type PlannedTool = [AllowedTool, string];

interface Plan {
  steps: PlannedTool[];
  text: string;
  ui?: unknown[];
}

function lastAssistantText(history: AgentRequest['history']): string | undefined {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const m = history[i];
    if (m?.role === 'assistant' && m.text) return m.text;
  }
  return undefined;
}

function planFor(
  request: AgentRequest,
  received: ReadonlySet<string>,
  newId: (prefix: string) => string,
): Plan {
  if (request.intent === 'status') {
    const reached = request.actionId !== undefined && received.has(request.actionId);
    return reached
      ? {
          steps: [['action.receive', 'İşlem kaydı okundu']],
          text: 'Onayınız sunucuya bir kez ulaştı. İşlem yeniden yapılmadı. Bu bir sahte sunucu. Bu yüzden gerçek bir işlem yapılmadı.',
        }
      : {
          steps: [],
          text: 'Onayınız sunucuya ulaşmadı. Hiçbir işlem yapılmadı. İsterseniz isteği yeniden yazın.',
        };
  }

  const { action } = request.message;
  if (action?.kind === 'confirm' || action?.kind === 'form') {
    if (action.decision === 'rejected') {
      return { steps: [], text: 'Vazgeçtiğinizi kaydettim. Hiçbir işlem yapılmadı.' };
    }
    return {
      steps: [['action.receive', 'Onayınız alındı']],
      text: 'Onayınızı aldım. Bu bir sahte sunucu. Bu yüzden gerçek bir işlem yapılmadı.',
    };
  }

  const text = request.message.text.toLocaleLowerCase('tr');
  if (/sat[ıi]ş|özet|rapor/.test(text)) {
    return {
      steps: [
        ['orders.read', 'Sipariş ve ödeme verileri okundu (7 gün)'],
        ['payments.read', 'Gelir, sipariş ve iade hesaplandı'],
        ['report.build', 'Grafik ve özet hazırlandı'],
      ],
      text: 'Bu hafta gelir geçen haftaya göre %12 arttı. En güçlü gün perşembe oldu. İade oranı %2,1 ile hedefin altında kaldı.',
      ui: [
        {
          type: 'kpis',
          items: [
            { label: 'Gelir', value: '₺ 482.300', delta: 12, unit: '%' },
            { label: 'Sipariş', value: '1.148', delta: 6, unit: '%' },
            { label: 'İade oranı', value: '%2,1', delta: -0.4, unit: ' puan', goodWhen: 'down' },
          ],
        },
        {
          type: 'chart',
          title: 'Günlük gelir (₺ bin)',
          bars: [
            { label: 'Pzt', value: 58 },
            { label: 'Sal', value: 61 },
            { label: 'Çar', value: 66 },
            { label: 'Per', value: 84 },
            { label: 'Cum', value: 79 },
            { label: 'Cmt', value: 72 },
            { label: 'Paz', value: 62 },
          ],
        },
        {
          type: 'choices',
          items: ['Geçen ayla karşılaştır', 'En çok satan 5 ürünü göster'],
        },
      ],
    };
  }
  if (/sipari[şs]|gecik|kargo/.test(text)) {
    return {
      steps: [
        ['shipments.read', 'Kargo durumları okundu (148 sipariş)'],
        ['orders.read', 'Gecikme riski sınıflandırıldı'],
        ['notify.draft', 'Müşteri bildirim taslağı hazırlandı'],
      ],
      text: '12 sipariş gecikme riskinde. Bunlardan 3 tanesi kritik. Müşterilere bildirim göndermemi isterseniz onay verin.',
      ui: [
        {
          type: 'table',
          title: 'Gecikme riski olan siparişler',
          rowKey: 'order',
          columns: [
            { key: 'order', title: 'Sipariş', kind: 'id' },
            { key: 'customer', title: 'Müşteri', kind: 'id' },
            { key: 'state', title: 'Durum', kind: 'id' },
            { key: 'delay', title: 'Gecikme', kind: 'id' },
            { key: 'note', title: 'Açıklama' },
          ],
          rows: [
            {
              order: '#10482',
              customer: 'Örnek Kişi 1',
              state: 'Kritik',
              delay: '3 gün',
              note: 'Kargo aktarma merkezinde bekliyor. Teslim tarihi henüz belli değil.',
            },
            {
              order: '#10477',
              customer: 'Örnek Kişi 2',
              state: 'Kritik',
              delay: '2 gün',
              note: 'Adres eksik.',
            },
            {
              order: '#10469',
              customer: 'Örnek Kişi 3',
              state: 'Kritik',
              delay: '2 gün',
              note: 'Stok bekliyor.',
            },
            {
              order: '#10451',
              customer: 'Örnek Kişi 4',
              state: 'Riskli',
              delay: '1 gün',
              note: 'Yolda.',
            },
          ],
        },
        {
          type: 'confirm',
          id: newId('notify-delay'),
          title: '12 müşteriye gecikme bildirimi gönderilsin mi?',
          summary: '12 müşteriye e-posta ve SMS gider. Gönderim geri alınamaz.',
          changes: [
            { field: 'Bildirim durumu', before: 'Gönderilmedi', after: 'Gönderildi' },
            { field: 'Kanal', before: 'Yok', after: 'E-posta ve SMS' },
            { field: 'Şablon', before: 'Yok', after: '“Siparişiniz yolda, kısa bir gecikme var.”' },
          ],
          confirmLabel: 'Gönder',
          cancelLabel: 'Vazgeç',
        },
      ],
    };
  }
  if (/otomasyon|kural|stok/.test(text)) {
    return {
      steps: [
        ['stock.read', 'Stok seviyeleri incelendi'],
        ['stock.read', 'Eşik önerisi hesaplandı (son 30 gün satış hızı)'],
        ['rule.draft', 'Kural formu oluşturuldu'],
      ],
      text: 'Stok uyarısı için bir kural önerdim. Değerleri düzenleyebilirsiniz. Kaydetmeden önce onayınızı bekliyorum.',
      ui: [
        {
          type: 'form',
          id: newId('stock-rule'),
          title: 'Stok uyarı kuralı',
          submitLabel: 'Kaydet',
          fields: [
            {
              name: 'name',
              label: 'Kural adı',
              kind: 'text',
              value: 'Düşük stok uyarısı',
              required: true,
            },
            {
              name: 'threshold',
              label: 'Eşik',
              kind: 'select',
              value: 'p20',
              options: [
                { value: 'p10', label: 'Stok %10 altı' },
                { value: 'p20', label: 'Stok %20 altı (önerilen)' },
                { value: 'd7', label: '7 günlük satışın altı' },
              ],
            },
            {
              name: 'channels',
              label: 'Kanal',
              kind: 'checks',
              value: ['email'],
              options: [
                { value: 'email', label: 'E-posta' },
                { value: 'sms', label: 'SMS' },
              ],
            },
          ],
        },
      ],
    };
  }
  // If a regenerate request is not a recognised question, the last reply is rewritten.
  // The mock server ignores approvals in history. By contract, approval is only in message.action.
  const previous = request.intent === 'regenerate' ? lastAssistantText(request.history) : undefined;
  if (previous) {
    return {
      steps: [],
      text: `Son yanıtı yeniden yazdım. Hiçbir işlem yeniden yapılmadı. ${previous}`,
    };
  }
  return {
    steps: [],
    text: 'Bunu yapabilirim. Hangi yönden ilerleyelim?',
    ui: [
      {
        type: 'choices',
        items: [
          'Bu haftanın satış özetini çıkar',
          'Geciken siparişleri bul',
          'Stok uyarısı için otomasyon kur',
        ],
      },
    ],
  };
}

/**
 * Creates a new approval ID for each new operation. By contract, the real server also
 * gives a new ID even when the same question is asked again.
 */
export function createIdFactory(): (prefix: string) => string {
  let next = 0;
  return (prefix) => {
    next += 1;
    return `${prefix}-${next}`;
  };
}

/** Turns the plan into an event sequence: tool events, text chunks, blocks, end. */
export function planEvents(
  request: AgentRequest,
  received: ReadonlySet<string> = new Set(),
  newId: (prefix: string) => string = createIdFactory(),
): AgentEvent[] {
  const plan = planFor(request, received, newId);
  const events: AgentEvent[] = [];
  plan.steps.forEach(([tool, title], index) => {
    events.push({ type: 'tool', key: `s${index}`, tool, title, status: 'pending' });
    events.push({ type: 'tool', key: `s${index}`, tool, title, status: 'success' });
  });
  for (const delta of plan.text.match(/\S+\s*/g) ?? [plan.text]) {
    events.push({ type: 'text', delta });
  }
  if (plan.ui) events.push({ type: 'ui', blocks: plan.ui });
  events.push({ type: 'done' });
  return events;
}

export interface MockTransportOptions {
  /** Wait between two events, ms. */
  delayMs?: number;
  /** Replaces the event list for tests. */
  events?: (
    request: AgentRequest,
    received: ReadonlySet<string>,
    newId: (prefix: string) => string,
  ) => AgentEvent[];
}

/**
 * Approval is single-use. The mock server keeps the approval IDs it receives.
 * If a second approval arrives with the same ID, it does not run the operation and returns an error.
 * The real server must apply the same rule.
 */
function admit(request: AgentRequest, received: Set<string>): AgentEvent[] | null {
  const action = request.message.action;
  if (request.intent !== 'message' || !action || action.kind === 'ask') return null;
  if (received.has(action.blockId)) {
    return [{ type: 'error', message: 'Bu onay zaten kullanıldı. İşlem yeniden yapılmadı.' }];
  }
  received.add(action.blockId);
  return null;
}

export function createMockTransport({
  delayMs = 45,
  events = planEvents,
}: MockTransportOptions = {}): AgentTransport {
  const received = new Set<string>();
  const newId = createIdFactory();
  return (request, signal) => {
    const queue = admit(request, received) ?? events(request, received, newId);
    const encoder = new TextEncoder();
    let index = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        return new Promise<void>((resolve) => {
          const timer = setTimeout(() => {
            signal.removeEventListener('abort', stop);
            const next = queue[index];
            if (signal.aborted || next === undefined) {
              controller.close();
            } else {
              index += 1;
              controller.enqueue(encoder.encode(encodeAgentEvent(next)));
            }
            resolve();
          }, delayMs);
          const stop = () => {
            clearTimeout(timer);
            controller.close();
            resolve();
          };
          signal.addEventListener('abort', stop, { once: true });
        });
      },
    });
    return Promise.resolve(stream);
  };
}
