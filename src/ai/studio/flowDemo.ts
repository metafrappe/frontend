import { createMockTransport, planEvents } from '../agent';
import type { AgentEvent, AgentMode, AgentRequest, MockTransportOptions } from '../agent';

/**
 * Kipi taşıyan istek. Ekran seçilen kipi isteğe ekler.
 * Gerçek sunucu da bu alanı okur. Yalnız "İşlem yap" kipi değişiklik önerir.
 */
export type ModedRequest = AgentRequest & { mode?: AgentMode };

export function modeOf(request: AgentRequest): AgentMode | undefined {
  return (request as ModedRequest).mode;
}

/** Sahte sunucu adım olayı da gönderir. Olay biçimi `flow.ts` içindeki `step` olayıdır. */
type DemoEvent = AgentEvent | { type: 'step'; step: string };

const FLOW_PREFIX = 'akis';

function tools(entries: [string, string][]): DemoEvent[] {
  return entries.flatMap(([tool, title], index): DemoEvent[] => [
    { type: 'tool', key: `f${index}`, tool, title, status: 'pending' },
    { type: 'tool', key: `f${index}`, tool, title, status: 'success' },
  ]);
}

function words(text: string): DemoEvent[] {
  return (text.match(/\S+\s*/g) ?? [text]).map((delta) => ({ type: 'text', delta }));
}

/** "İşlem yap" kipinde yeni iş: plan, önizleme ve onay adımları. */
function proposal(text: string, newId: (prefix: string) => string): DemoEvent[] {
  const cancel = /iptal|sil/i.test(text);
  const scope = {
    type: 'scope',
    tenant: 'Örnek Şirket',
    environment: 'Deneme',
    mode: 'act',
    scope: 'Satış, siparişler',
  };
  const changes = cancel
    ? [{ field: 'Durum', before: 'Açık', after: 'İptal edildi' }]
    : [{ field: 'Teslim tarihi', before: '11 Aralık 2026', after: '12 Aralık 2026' }];
  const summary = cancel
    ? 'SO-0041 siparişi iptal edilir.'
    : 'SO-0041 siparişinin teslim tarihi bir gün ileri alınır.';
  const sources = [{ title: 'Sipariş SO-0041. Kayıt örnektir.' }];
  const review = {
    type: 'review',
    summary,
    risk: cancel ? 'R3' : 'R1',
    target: 'Sipariş SO-0041, Örnek Müşteri 3',
    reversible: cancel
      ? 'Hayır. İptal edilen sipariş kendiliğinden geri gelmez.'
      : 'Kendiliğinden geri alınmaz. Ters değişiklik yeni öneri olarak açılır.',
    changes,
    sources,
  };
  const confirm = {
    type: 'confirm',
    id: newId(FLOW_PREFIX),
    title: cancel ? 'Siparişi iptal et' : 'Teslim tarihini değiştir',
    summary: `${summary} Bu bir deneme. Gerçek kayıt değişmez.`,
    changes,
    confirmLabel: 'Onayla',
    cancelLabel: 'Reddet',
    risk: cancel ? 'R3' : 'R1',
    target: { label: 'Sipariş SO-0041, Örnek Müşteri 3', name: 'SO-0041' },
  };
  return [
    { type: 'step', step: 'plan' },
    ...tools([
      ['orders.read', 'SO-0041 siparişi okundu. Örnek olay.'],
      ['shipments.read', 'Sevkiyat planı okundu. Örnek olay.'],
    ]),
    { type: 'step', step: 'preview' },
    ...words('Öneri hazır. Önce önizlemeyi okuyun. Onayı yalnız siz verirsiniz.'),
    { type: 'ui', blocks: [scope, review, confirm] },
    { type: 'step', step: 'approval' },
    { type: 'done' },
  ];
}

/** Akış onayı: uygulama adımı ve sonuç yüzeyi. Sunucu işi bir kez yapar. */
function applied(): DemoEvent[] {
  return [
    { type: 'step', step: 'apply' },
    ...tools([['action.receive', 'Onayınız alındı. Örnek olay.']]),
    ...words('İşlem bir kez yapıldı. Bu bir deneme. Kayıt değişmedi.'),
    {
      type: 'ui',
      blocks: [
        { type: 'result', outcome: 'succeeded', summary: 'Örnek sonuçtur. Kayıt değişmedi.' },
      ],
    },
    { type: 'done' },
  ];
}

/**
 * Dar ekran testleri için uzun içerik örneği (AJA-1782).
 * Almanca ve Fince bileşik sözcükler, uzun bir bağlantı, kod bloğu ve geniş tablo içerir.
 */
export const LONG_CONTENT_TRIGGER = /uzun içerik/i;

function longContent(): DemoEvent[] {
  const link =
    'https://beispiel.example/handbuch/Betriebsumgebungstemperatur/Druckluftschlauch-mit-Schnellkupplung-10m-12mm?abschnitt=lentokonesuihkuturbiinimoottoriapumekaanikkoaliupseerioppilas';
  const code = [
    '```bash',
    'curl --request GET "https://beispiel.example/api/v1/Betriebsumgebungstemperatur?einheit=celsius&bereich=-20..60&lentokonesuihkuturbiinimoottoriapumekaanikkoaliupseerioppilas=true"',
    '```',
  ].join('\n');
  const text = [
    'Örnek yanıt. Betriebsumgebungstemperatur ve lentokonesuihkuturbiinimoottoriapumekaanikkoaliupseerioppilas sözcükleri uzundur.',
    `Kaynak: ${link}`,
    code,
    'Tablo aşağıdadır.',
  ].join('\n');
  const table = {
    type: 'table',
    title: 'Uzun içerik örneği',
    rowKey: 'code',
    columns: [
      { key: 'code', title: 'Kod' },
      { key: 'name', title: 'Bezeichnung' },
      { key: 'fi', title: 'Nimike' },
      { key: 'range', title: 'Betriebsumgebungstemperatur', kind: 'id' },
      { key: 'unit', title: 'Verkaufseinheit', kind: 'id' },
      { key: 'price', title: 'Stückpreis', kind: 'id' },
    ],
    rows: [
      {
        code: 'DS-10-12',
        name: 'Druckluftschlauch mit Schnellkupplung, 10 m / 12 mm',
        fi: 'lentokonesuihkuturbiinimoottoriapumekaanikkoaliupseerioppilas',
        range: '−20 … +60 °C',
        unit: 'Karton zu 10 Stück',
        price: '24,90 €',
      },
      {
        code: 'DS-10-16',
        name: 'Druckluftschlauch mit Schnellkupplung, 10 m / 16 mm',
        fi: 'Betriebsumgebungstemperatur',
        range: '−20 … +60 °C',
        unit: 'Karton zu 10 Stück',
        price: '29,90 €',
      },
    ],
  };
  return [...words(text), { type: 'ui', blocks: [table] }, { type: 'done' }];
}

/**
 * Sahte sunucunun olay listesi. "İşlem yap" kipindeki yeni iş altı adımlı akışı izler.
 * Başka her istek mevcut sahte sunucuya gider.
 */
export function flowDemoEvents(
  request: AgentRequest,
  received: ReadonlySet<string>,
  newId: (prefix: string) => string,
): AgentEvent[] {
  const action = request.message.action;
  if (request.intent === 'message' && action?.kind === 'confirm') {
    if (action.blockId.startsWith(`${FLOW_PREFIX}-`)) {
      return (
        action.decision === 'approved'
          ? applied()
          : [...words('Reddettiniz. Hiçbir işlem yapılmadı.'), { type: 'done' }]
      ) as AgentEvent[];
    }
  }
  if (request.intent === 'message' && !action && modeOf(request) === 'act') {
    return proposal(request.message.text, newId) as AgentEvent[];
  }
  if (request.intent === 'message' && !action && LONG_CONTENT_TRIGGER.test(request.message.text)) {
    return longContent() as AgentEvent[];
  }
  return planEvents(request, received, newId);
}

/** Akış senaryolu sahte sunucu. Yalnız e2e derlemesinde ve testlerde kullanılır. */
export function createFlowDemoTransport(options: Pick<MockTransportOptions, 'delayMs'> = {}) {
  return createMockTransport({ ...options, events: flowDemoEvents });
}
