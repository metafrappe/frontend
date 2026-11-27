/**
 * Sunucudan gelen GenUI bloklarını doğrular (U2, AX-4).
 *
 * Türü, alanları ve boyutu denetler. Geçmeyen blok `unknown` olur.
 * `unknown` bloğun türü ilk altı bloktan biriyse düz JSON metni olarak çizilir.
 * Başka her `unknown` blok hiç çizilmez (model belgesi: "Liste dışı blok çizilmez").
 *
 * Altı yapay zekâ yüzeyi (AJA-1156) katı doğrulanır. Tanımsız alan bloğu reddeder.
 * Böylece güven yüzdesi ya da modelin iç düşüncesi ekrana gelemez.
 */
import type {
  AssistMode,
  ChartBar,
  ConfirmRisk,
  ConfirmTarget,
  FieldChange,
  FormField,
  FormOption,
  GenUIBlock,
  KnownBlock,
  KpiItem,
  QueueItem,
  ResultOutcome,
  RiskLevel,
  SourceItem,
  TableCell,
  TableColumn,
  ToolEvent,
  ToolEventStatus,
} from './types';

/** Boyut sınırları. Büyük blok ekranı ve belleği zorlamasın. */
export const LIMITS = {
  text: 500,
  items: 12,
  bars: 31,
  columns: 8,
  rows: 50,
  fields: 12,
  options: 20,
  blocks: 12,
  events: 30,
  sources: 8,
  queue: 20,
  url: 2048,
} as const;

type Obj = Record<string, unknown>;

function isObj(value: unknown): value is Obj {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown, required = true): value is string {
  if (value === undefined) return !required;
  return (
    typeof value === 'string' && value.length <= LIMITS.text && (!required || value.length > 0)
  );
}

function num(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function list<T>(value: unknown, max: number, check: (item: unknown) => item is T): value is T[] {
  return Array.isArray(value) && value.length > 0 && value.length <= max && value.every(check);
}

function isRisk(value: unknown): value is ConfirmRisk {
  return value === 'R1' || value === 'R2' || value === 'R3';
}

function isTarget(value: unknown): value is ConfirmTarget {
  return (
    isObj(value) &&
    str(value['label']) &&
    str(value['name']) &&
    // Boşluktan ibaret ad yazılarak onaylanamaz.
    value['name'].trim().length > 0
  );
}

function isKpi(value: unknown): value is KpiItem {
  return (
    isObj(value) &&
    str(value['label']) &&
    str(value['value']) &&
    (value['delta'] === undefined || num(value['delta'])) &&
    str(value['unit'], false) &&
    (value['goodWhen'] === undefined || value['goodWhen'] === 'up' || value['goodWhen'] === 'down')
  );
}

function isBar(value: unknown): value is ChartBar {
  return isObj(value) && str(value['label']) && num(value['value']) && value['value'] >= 0;
}

function isColumn(value: unknown): value is TableColumn {
  const kind = value && isObj(value) ? value['kind'] : undefined;
  return (
    isObj(value) &&
    str(value['key']) &&
    str(value['title']) &&
    (kind === undefined || kind === 'id' || kind === 'text')
  );
}

function isChange(value: unknown): value is FieldChange {
  return (
    isObj(value) && str(value['field']) && str(value['before'], false) && str(value['after'], false)
  );
}

function isCell(value: unknown): value is TableCell {
  return num(value) || str(value, false);
}

function isRow(value: unknown): value is Record<string, TableCell> {
  return isObj(value) && Object.values(value).every(isCell);
}

function isOption(value: unknown): value is FormOption {
  return isObj(value) && str(value['value']) && str(value['label']);
}

function isField(value: unknown): value is FormField {
  if (!isObj(value) || !str(value['name']) || !str(value['label'])) return false;
  const kind = value['kind'];
  if (kind !== 'text' && kind !== 'select' && kind !== 'checks') return false;
  const options = value['options'];
  if (kind !== 'text' && !list(options, LIMITS.options, isOption)) return false;
  const v = value['value'];
  const valueOk =
    v === undefined ||
    str(v, false) ||
    (Array.isArray(v) && v.length <= LIMITS.options && v.every((x) => str(x)));
  return valueOk && (value['required'] === undefined || typeof value['required'] === 'boolean');
}

function isChoice(value: unknown): value is string {
  return str(value);
}

/* --- Yapay zekâ yüzeyleri --- */

/** Nesnede yalnız izinli alanlar varsa `true` döner. Fazladan alan reddedilir. */
function only(value: Obj, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

/** Boş olabilen liste. Kaynak kartı ve karar kuyruğu boş durumu kendisi yazar. */
function listOrEmpty<T>(
  value: unknown,
  max: number,
  check: (item: unknown) => item is T,
): value is T[] {
  return Array.isArray(value) && value.length <= max && value.every(check);
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

function uniqueIds(items: { id: string }[]): boolean {
  return new Set(items.map((item) => item.id)).size === items.length;
}

const MODES: readonly AssistMode[] = ['ask', 'search', 'draft', 'act'];
const EVENT_STATUSES: readonly ToolEventStatus[] = ['running', 'done', 'failed'];
const RISKS: readonly RiskLevel[] = ['R0', 'R1', 'R2', 'R3'];
const OUTCOMES: readonly ResultOutcome[] = ['succeeded', 'failed', 'unknown'];

/**
 * Bağlantı yalnız `http(s)://` ya da uygulama içi `/yol` olur.
 * `javascript:`, `data:` ve `//alan` biçimleri reddedilir.
 */
function isSafeUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > LIMITS.url) return false;
  if (/\s/.test(value)) return false;
  if (value.startsWith('/')) return !value.startsWith('//') && !value.startsWith('/\\');
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function isSource(value: unknown): value is SourceItem {
  return (
    isObj(value) &&
    only(value, ['title', 'url']) &&
    str(value['title']) &&
    (value['url'] === undefined || isSafeUrl(value['url']))
  );
}

function isEvent(value: unknown): value is ToolEvent {
  return (
    isObj(value) &&
    only(value, ['id', 'tool', 'summary', 'status']) &&
    str(value['id']) &&
    str(value['tool']) &&
    str(value['summary']) &&
    oneOf(value['status'], EVENT_STATUSES)
  );
}

function isStrictChange(value: unknown): value is FieldChange {
  return isObj(value) && only(value, ['field', 'before', 'after']) && isChange(value);
}

function isQueueItem(value: unknown): value is QueueItem {
  return (
    isObj(value) &&
    only(value, ['id', 'title', 'detail', 'risk']) &&
    str(value['id']) &&
    str(value['title']) &&
    str(value['detail'], false) &&
    oneOf(value['risk'], RISKS)
  );
}

/** Altı yüzeyi doğrular. Yüzey türü değilse `undefined` döner. */
function validateSurface(raw: Obj): boolean | undefined {
  switch (raw['type']) {
    case 'scope':
      return (
        only(raw, ['type', 'tenant', 'environment', 'mode', 'scope']) &&
        str(raw['tenant']) &&
        str(raw['environment']) &&
        oneOf(raw['mode'], MODES) &&
        str(raw['scope'], false)
      );
    case 'events':
      return (
        only(raw, ['type', 'items']) &&
        list(raw['items'], LIMITS.events, isEvent) &&
        uniqueIds(raw['items'])
      );
    case 'source':
      return only(raw, ['type', 'items']) && listOrEmpty(raw['items'], LIMITS.sources, isSource);
    case 'review':
      return (
        only(raw, ['type', 'summary', 'risk', 'target', 'reversible', 'changes', 'sources']) &&
        str(raw['summary']) &&
        oneOf(raw['risk'], RISKS) &&
        str(raw['target']) &&
        str(raw['reversible']) &&
        list(raw['changes'], LIMITS.fields, isStrictChange) &&
        (raw['sources'] === undefined || listOrEmpty(raw['sources'], LIMITS.sources, isSource))
      );
    case 'queue':
      return (
        only(raw, ['type', 'items']) &&
        listOrEmpty(raw['items'], LIMITS.queue, isQueueItem) &&
        uniqueIds(raw['items'])
      );
    case 'result':
      return (
        only(raw, ['type', 'outcome', 'summary']) &&
        oneOf(raw['outcome'], OUTCOMES) &&
        str(raw['summary'])
      );
    default:
      return undefined;
  }
}

/** İlk altı blok. Bunlar doğrulanamazsa düz JSON metni olarak çizilir (AX-6). */
const JSON_FALLBACK_TYPES: readonly string[] = [
  'kpis',
  'chart',
  'table',
  'confirm',
  'form',
  'choices',
];

/** Güven, olasılık ya da iç düşünce taşıyan alan adları. */
const FORBIDDEN_KEY =
  /^(confidence|certainty|probability|g(u|ü)ven|reasoning|thinking|thoughts?|chain_?of_?thought|rationale)/i;

function hasForbiddenKey(value: unknown, depth = 0): boolean {
  if (depth > 6) return true;
  if (Array.isArray(value)) return value.some((item) => hasForbiddenKey(item, depth + 1));
  if (!isObj(value)) return false;
  return Object.entries(value).some(
    ([key, item]) => FORBIDDEN_KEY.test(key) || hasForbiddenKey(item, depth + 1),
  );
}

/**
 * Doğrulanamayan blok ham JSON olarak gösterilsin mi?
 * Yalnız ilk altı bloğun türü ve yasak alan taşımayan veri gösterilir.
 * Kayıtta olmayan tür ve yüzey türleri hiç çizilmez.
 */
export function showsRawJson(raw: unknown): boolean {
  return (
    isObj(raw) &&
    typeof raw['type'] === 'string' &&
    JSON_FALLBACK_TYPES.includes(raw['type']) &&
    !hasForbiddenKey(raw)
  );
}

/** Bloğu doğrular. Geçerliyse aynı nesneyi tipli döndürür. */
function validate(raw: Obj): KnownBlock | null {
  const surface = validateSurface(raw);
  if (surface !== undefined) return surface ? (raw as unknown as KnownBlock) : null;
  switch (raw['type']) {
    case 'kpis':
      return list(raw['items'], LIMITS.items, isKpi) ? (raw as unknown as KnownBlock) : null;
    case 'chart':
      return str(raw['title']) && list(raw['bars'], LIMITS.bars, isBar)
        ? (raw as unknown as KnownBlock)
        : null;
    case 'table': {
      if (!str(raw['title']) || !str(raw['rowKey'])) return null;
      if (!list(raw['columns'], LIMITS.columns, isColumn)) return null;
      if (!list(raw['rows'], LIMITS.rows, isRow)) return null;
      const rowKey = raw['rowKey'];
      const keys = raw['rows'].map((row) => row[rowKey]);
      // AD-9: satır anahtarı kararlı ve tekil olmalı.
      if (keys.some((key) => key === undefined) || new Set(keys).size !== keys.length) return null;
      return raw as unknown as KnownBlock;
    }
    case 'confirm':
      // AX-6: değişiklik listesi olmayan onay çizilmez. Düğmesiz JSON görünümüne düşer.
      return str(raw['id']) &&
        str(raw['title']) &&
        str(raw['summary']) &&
        list(raw['changes'], LIMITS.fields, isChange) &&
        // Button texts belong to the card and follow the UI language (AJA-1859). Old labels are still accepted.
        str(raw['confirmLabel'], false) &&
        str(raw['cancelLabel'], false) &&
        (raw['danger'] === undefined || typeof raw['danger'] === 'boolean') &&
        (raw['expiresAt'] === undefined ||
          (str(raw['expiresAt']) && Number.isFinite(Date.parse(raw['expiresAt'])))) &&
        (raw['risk'] === undefined || isRisk(raw['risk'])) &&
        (raw['target'] === undefined || isTarget(raw['target'])) &&
        // R3 onayında kullanıcı hedefin adını yazar. Hedef yoksa onay çizilmez.
        (raw['risk'] !== 'R3' || raw['target'] !== undefined) &&
        (raw['undoProposal'] === undefined || typeof raw['undoProposal'] === 'boolean')
        ? (raw as unknown as KnownBlock)
        : null;
    case 'form':
      return str(raw['id']) &&
        str(raw['title']) &&
        str(raw['submitLabel'], false) &&
        str(raw['cancelLabel'], false) &&
        list(raw['fields'], LIMITS.fields, isField)
        ? (raw as unknown as KnownBlock)
        : null;
    case 'choices':
      return list(raw['items'], LIMITS.items, isChoice) ? (raw as unknown as KnownBlock) : null;
    default:
      return null;
  }
}

export function parseBlock(raw: unknown): GenUIBlock {
  if (!isObj(raw)) return { type: 'unknown', raw };
  return validate(raw) ?? { type: 'unknown', raw };
}

/** `ui` alanını doğrular. Dizi değilse tek bir JSON bloğu döner. */
export function parseBlocks(raw: unknown): GenUIBlock[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) return [{ type: 'unknown', raw }];
  return raw.slice(0, LIMITS.blocks).map(parseBlock);
}
