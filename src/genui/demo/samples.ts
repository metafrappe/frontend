/**
 * Sample blocks for the six surfaces. The demo page and tests use this data.
 * The data are raw objects, as if from the server. The screen runs them through the schema.
 * Names and records are samples.
 */
export type RawBlock = { type: string } & Record<string, unknown>;

export const SURFACE_SAMPLES: RawBlock[] = [
  {
    type: 'scope',
    tenant: 'Örnek Şirket',
    environment: 'Deneme',
    mode: 'act',
    scope: 'İnsan kaynakları, izin talepleri',
  },
  {
    type: 'events',
    items: [
      {
        id: 'e1',
        tool: 'izin_talebi.oku',
        summary: 'İZN-0041 okundu. Örnek olay.',
        status: 'done',
      },
      {
        id: 'e2',
        tool: 'izin_bakiyesi.hesapla',
        summary: 'Kalan izin 11 gün. Örnek olay.',
        status: 'done',
      },
      {
        id: 'e3',
        tool: 'oneri.ac',
        summary: 'Değişiklik önerisi açılıyor. Örnek olay.',
        status: 'running',
      },
    ],
  },
  {
    type: 'source',
    items: [
      { title: 'İzin talebi İZN-0041', url: '/hr/leave-application/IZN-0041' },
      { title: 'Örnek Kişi 3 izin bakiyesi' },
    ],
  },
  {
    type: 'review',
    summary: 'İZN-0041 talebinin bitiş tarihi bir gün öne alınır.',
    risk: 'R1',
    target: 'İzin talebi İZN-0041, Örnek Kişi 3',
    reversible: 'Kendiliğinden geri alınmaz. Geri almak için yeni bir öneri açılır.',
    changes: [
      { field: 'Bitiş tarihi', before: '12 Aralık 2026', after: '11 Aralık 2026' },
      { field: 'Gün sayısı', before: '5', after: '4' },
    ],
    sources: [{ title: 'İzin talebi İZN-0041', url: '/hr/leave-application/IZN-0041' }],
  },
  {
    type: 'queue',
    items: [
      {
        id: 'IZN-0041',
        title: 'Örnek Kişi 3: Yıllık izin',
        detail:
          '8 Aralık 2026 Salı gününden 12 Aralık 2026 Cumartesi gününe kadar. 5 gün. Kalan izni 11 gün.',
        risk: 'R1',
      },
      {
        id: 'IZN-0042',
        title: 'Örnek Kişi 5: Mazeret izni',
        detail: '1 Aralık 2026 Salı günü. 1 gün. Kalan izni 4 gün.',
        risk: 'R1',
      },
    ],
  },
  {
    type: 'result',
    outcome: 'succeeded',
    summary: 'İZN-0041 talebinin bitiş tarihi 11 Aralık 2026 oldu. Örnek sonuçtur.',
  },
];

/** Extra states: high-risk review, empty source, empty queue and failed result. */
export const SURFACE_STATES: RawBlock[] = [
  {
    type: 'review',
    summary: 'Örnek Kişi 7 kullanıcısı silinir.',
    risk: 'R3',
    target: 'Kullanıcı: Örnek Kişi 7',
    reversible: 'Hayır. Silinen kullanıcı geri gelmez.',
    changes: [
      { field: 'Hesap', before: 'Etkin', after: 'Silindi' },
      { field: 'Roller', before: 'Standart çalışan', after: 'Yok' },
    ],
    sources: [{ title: 'Kullanıcı listesi', url: '/admin/users' }],
  },
  { type: 'source', items: [] },
  { type: 'queue', items: [] },
  { type: 'result', outcome: 'failed', summary: 'Bildirim gönderilemedi. Örnek sonuçtur.' },
  { type: 'result', outcome: 'unknown', summary: 'Sunucu yanıt vermedi. Örnek sonuçtur.' },
];
