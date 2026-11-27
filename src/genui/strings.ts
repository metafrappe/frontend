// Plain TypeScript only. The Node test config (`hardcoded-text.node.test.ts`) reads this file.
// The React hook lives in `useGenuiStrings.ts`.
import type { AppLanguage } from '../app/locale/language';

import type { AssistMode, ResultOutcome, RiskLevel, ToolEventStatus } from './types';

/**
 * GenUI card texts in every UI language (AJA-1859).
 * Visible labels, screen reader names and notes come from this one table.
 * So a card speaks the same language as `antd` and `XProvider`.
 * The server sends only codes and its own content. Example: the risk code `R2` and the card title.
 * Button texts belong to the card. The server's `confirmLabel` and `cancelLabel` are not shown.
 */
export interface GenuiStrings {
  /** Approve button of the confirm card. */
  approve: string;
  /** Reject button of the confirm card and cancel button of the form card. */
  reject: string;
  approvedNote: string;
  rejectedNote: string;
  undoLabel: string;
  /** Message sent to the assistant when the user asks to undo an operation. */
  undoRequest: (title: string) => string;
  riskLevel: string;
  targetRecord: string;
  reversible: string;
  r2Check: string;
  r3Prompt: string;
  r3Hint: string;
  r3Ok: string;
  busyNote: string;
  failedNote: string;
  expiredLabel: string;
  expiredNote: string;
  usedNote: string;
  riskLabels: Record<RiskLevel, string>;
  modeLabels: Record<AssistMode, string>;
  eventLabels: Record<ToolEventStatus, string>;
  outcomeLabels: Record<ResultOutcome, string>;
  changes: { name: string; before: string; after: string; empty: string };
  toolEvents: string;
  queue: {
    count: (count: number) => string;
    none: string;
    empty: string;
    list: string;
  };
  source: string;
  noSources: string;
  newTab: string;
  review: string;
  scope: { name: string; tenant: string; environment: string; mode: string; scope: string };
  suggestions: string;
  kpis: string;
  unknownBlock: string;
  rows: (count: number) => string;
  form: {
    save: string;
    approveAndSend: string;
    backToEdit: string;
    review: string;
    approvedNote: string;
    rejectedNote: string;
    required: (label: string) => string;
    tagApproved: string;
    tagRejected: string;
    tagUsed: string;
    tagCheck: string;
    tagDraft: string;
  };
  demo: { title: string; note: string; sample: string; states: string };
}

/** A language table may miss a text. The missing text comes from the fallback language. */
export type GenuiTranslation = {
  [K in keyof GenuiStrings]?: GenuiStrings[K] extends (...args: never[]) => string
    ? GenuiStrings[K]
    : GenuiStrings[K] extends object
      ? Partial<GenuiStrings[K]>
      : GenuiStrings[K];
};

/** British English. The UI's fallback language (AJA-1407). */
const EN: GenuiStrings = {
  approve: 'Approve',
  reject: 'Cancel',
  approvedNote: 'Your approval was sent. The assistant will report the result in a new message.',
  rejectedNote: 'You cancelled. No operation was carried out.',
  undoLabel: 'Propose an undo',
  undoRequest: (title) => `Open a new proposal to undo "${title}".`,
  riskLevel: 'Risk level',
  targetRecord: 'Target record',
  reversible: 'Can it be undone?',
  r2Check: 'I have read the preview.',
  r3Prompt: "Type the target's name to approve:",
  r3Hint: 'The "Approve" button opens when the name is typed correctly.',
  r3Ok: 'The name is correct. The "Approve" button is open.',
  busyNote: 'You can approve when the reply has finished.',
  failedNote: 'The approval was not sent. Try again when the reply has finished.',
  expiredLabel: 'Expired',
  expiredNote: 'This proposal can no longer be approved. Ask the assistant for a new proposal.',
  usedNote: 'This approval was already sent. The operation was not carried out again.',
  riskLabels: { R0: 'R0 Read', R1: 'R1 Low', R2: 'R2 Medium', R3: 'R3 High' },
  modeLabels: { ask: 'Ask', search: 'Search', draft: 'Draft', act: 'Take action' },
  eventLabels: { running: 'Running', done: 'Done', failed: 'Failed' },
  outcomeLabels: {
    succeeded: 'Result: succeeded.',
    failed: 'Result: failed.',
    unknown: 'Result: unknown.',
  },
  changes: { name: 'Fields to change', before: 'Before', after: 'After', empty: 'Empty' },
  toolEvents: 'Tool events',
  queue: {
    count: (count) =>
      count === 1 ? '1 item awaits your decision' : `${count} items await your decision`,
    none: 'No pending decisions',
    empty: 'No items await your decision.',
    list: 'Pending decisions',
  },
  source: 'Source',
  noSources: 'No sources.',
  newTab: '(opens in a new tab)',
  review: 'Change proposal',
  scope: {
    name: 'Scope',
    tenant: 'Tenant',
    environment: 'Environment',
    mode: 'Mode',
    scope: 'Scope',
  },
  suggestions: 'Suggestions',
  kpis: 'Indicators',
  unknownBlock: 'This block was not recognised. The raw data is shown.',
  rows: (count) => (count === 1 ? '1 row' : `${count} rows`),
  form: {
    save: 'Save',
    approveAndSend: 'Approve and send',
    backToEdit: 'Back to editing',
    review: 'This change will be sent. Check it and approve.',
    approvedNote:
      'The values were sent. The assistant will report the save result in a new message.',
    rejectedNote: 'You cancelled. Nothing was saved.',
    required: (label) => `${label} is required.`,
    tagApproved: 'Approval sent',
    tagRejected: 'Cancelled',
    tagUsed: 'Already sent',
    tagCheck: 'Check the change',
    tagDraft: 'Draft, awaiting your approval',
  },
  demo: {
    title: 'AI surfaces',
    note: 'The blocks on this page are samples. The events did not come from the server.',
    sample: 'Sample reply',
    states: 'Other states',
  },
};

const TR: GenuiTranslation = {
  approve: 'Onayla',
  reject: 'Vazgeç',
  approvedNote: 'Onayınız gönderildi. Sonucu asistan yeni mesajla bildirecek.',
  rejectedNote: 'Vazgeçtiniz. Hiçbir işlem yapılmadı.',
  undoLabel: 'Geri almayı öner',
  undoRequest: (title) => `"${title}" işlemini geri almak için yeni bir öneri aç.`,
  riskLevel: 'Risk düzeyi',
  targetRecord: 'Hedef kayıt',
  reversible: 'Geri alınabilir mi?',
  r2Check: 'Önizlemeyi okudum.',
  r3Prompt: 'Onaylamak için hedefin adını yazın:',
  r3Hint: '"Onayla" düğmesi ad doğru yazılınca açılır.',
  r3Ok: 'Ad doğru. "Onayla" düğmesi açıldı.',
  busyNote: 'Yanıt bitince onay verebilirsiniz.',
  failedNote: 'Onay gönderilemedi. Yanıt bitince yeniden deneyin.',
  expiredLabel: 'Süresi doldu',
  expiredNote: 'Bu öneri artık onaylanamaz. Asistandan yeni öneri isteyin.',
  usedNote: 'Bu onay daha önce gönderildi. İşlem yeniden yapılmadı.',
  riskLabels: { R0: 'R0 Okuma', R1: 'R1 Düşük', R2: 'R2 Orta', R3: 'R3 Yüksek' },
  modeLabels: { ask: 'Sor', search: 'Ara', draft: 'Taslak hazırla', act: 'İşlem yap' },
  eventLabels: { running: 'Sürüyor', done: 'Bitti', failed: 'Başarısız' },
  outcomeLabels: {
    succeeded: 'Sonuç: başarılı.',
    failed: 'Sonuç: başarısız.',
    unknown: 'Sonuç: bilinmiyor.',
  },
  changes: { name: 'Değişecek alanlar', before: 'Önce', after: 'Sonra', empty: 'Boş' },
  toolEvents: 'Araç olayları',
  queue: {
    count: (count) => `Kararınızı bekleyen ${count} iş var`,
    none: 'Bekleyen karar yok',
    empty: 'Kararınızı bekleyen iş yok.',
    list: 'Bekleyen kararlar',
  },
  source: 'Kaynak',
  noSources: 'Kaynak yok.',
  newTab: '(yeni sekmede açılır)',
  review: 'Değişiklik önerisi',
  scope: {
    name: 'Kapsam',
    tenant: 'Kiracı',
    environment: 'Ortam',
    mode: 'Kip',
    scope: 'Kapsam',
  },
  suggestions: 'Öneriler',
  kpis: 'Göstergeler',
  unknownBlock: 'Bu blok tanınmadı. Ham veri gösteriliyor.',
  rows: (count) => `${count} satır`,
  form: {
    save: 'Kaydet',
    approveAndSend: 'Onayla ve gönder',
    backToEdit: 'Düzenlemeye dön',
    review: 'Şu değişiklik gönderilecek. Kontrol edip onaylayın.',
    approvedNote: 'Değerler gönderildi. Kayıt sonucunu asistan yeni mesajla bildirecek.',
    rejectedNote: 'Vazgeçtiniz. Hiçbir kayıt yapılmadı.',
    required: (label) => `${label} gerekli.`,
    tagApproved: 'Onay gönderildi',
    tagRejected: 'Vazgeçildi',
    tagUsed: 'Daha önce gönderildi',
    tagCheck: 'Değişikliği kontrol edin',
    tagDraft: 'Taslak, onayınızı bekliyor',
  },
  demo: {
    title: 'Yapay zekâ yüzeyleri',
    note: 'Bu sayfadaki bloklar örnektir. Olaylar sunucudan gelmedi.',
    sample: 'Örnek yanıt',
    states: 'Öteki durumlar',
  },
};

/** The fallback language's complete table. */
export const GENUI_FALLBACK_STRINGS: GenuiStrings = EN;

/** Raw table of every language. A test checks that each table is complete. */
export const GENUI_TRANSLATIONS: Record<AppLanguage, GenuiTranslation> = { tr: TR, en: EN };

function present(value: unknown): boolean {
  return typeof value === 'function' || (typeof value === 'string' && value.trim() !== '');
}

/**
 * Fills a language table from the fallback language.
 * A missing or empty text becomes the British English text. So a button is never empty.
 */
export function resolveGenuiStrings(table: GenuiTranslation): GenuiStrings {
  const base = GENUI_FALLBACK_STRINGS as unknown as Record<string, unknown>;
  const own = table as Record<string, unknown>;
  const merged: Record<string, unknown> = {};
  for (const [key, fallback] of Object.entries(base)) {
    const value = own[key];
    if (fallback && typeof fallback === 'object') {
      const group = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
      merged[key] = Object.fromEntries(
        Object.entries(fallback).map(([name, text]) => [
          name,
          present(group[name]) ? group[name] : text,
        ]),
      );
    } else {
      merged[key] = present(value) ? value : fallback;
    }
  }
  return merged as unknown as GenuiStrings;
}

const RESOLVED = Object.fromEntries(
  Object.entries(GENUI_TRANSLATIONS).map(([language, table]) => [
    language,
    resolveGenuiStrings(table),
  ]),
) as Record<AppLanguage, GenuiStrings>;

/** Texts for a language. Missing texts are already filled from the fallback language. */
export function genuiStrings(language: AppLanguage): GenuiStrings {
  return RESOLVED[language];
}
