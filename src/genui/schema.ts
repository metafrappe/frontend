/**
 * Validates GenUI blocks from the server (U2, AX-4).
 *
 * Checks type, fields and size. A block that fails becomes `unknown`.
 * If an `unknown` block's type is one of the first six blocks, it is drawn as plain JSON text.
 * Every other `unknown` block is not drawn (model document: "Off-list blocks are not drawn").
 *
 * The six AI surfaces (AJA-1156) are validated strictly. An undefined field rejects the block.
 * So a confidence percentage or the model's internal reasoning cannot reach the screen.
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

/** Size limits. A large block must not strain the screen or memory. */
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
    // Typing a whitespace-only name cannot approve.
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

/* --- AI surfaces --- */

/** Returns `true` if the object has only allowed fields. Extra fields are rejected. */
function only(value: Obj, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

/** List that may be empty. The source card and decision queue render their own empty state. */
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
 * A link is only `http(s)://` or an in-app `/yol` path.
 * `javascript:`, `data:` and `//alan` forms are rejected.
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

/** Validates the six surfaces. Returns `undefined` if the type is not a surface. */
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

/** The first six blocks. If these fail validation they are drawn as plain JSON text (AX-6). */
const JSON_FALLBACK_TYPES: readonly string[] = [
  'kpis',
  'chart',
  'table',
  'confirm',
  'form',
  'choices',
];

/** Field names that carry confidence, probability or internal reasoning. */
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
 * Should a block that failed validation be shown as raw JSON?
 * Only the first six block types with data carrying no forbidden field are shown.
 * Unregistered types and surface types are not drawn at all.
 */
export function showsRawJson(raw: unknown): boolean {
  return (
    isObj(raw) &&
    typeof raw['type'] === 'string' &&
    JSON_FALLBACK_TYPES.includes(raw['type']) &&
    !hasForbiddenKey(raw)
  );
}

/** Validates a block. If valid, returns the same object, typed. */
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
      // AD-9: the row key must be stable and unique.
      if (keys.some((key) => key === undefined) || new Set(keys).size !== keys.length) return null;
      return raw as unknown as KnownBlock;
    }
    case 'confirm':
      // AX-6: a confirm without changes is not drawn. It falls back to the buttonless JSON view.
      return str(raw['id']) &&
        str(raw['title']) &&
        str(raw['summary']) &&
        list(raw['changes'], LIMITS.fields, isChange) &&
        str(raw['confirmLabel']) &&
        str(raw['cancelLabel']) &&
        (raw['danger'] === undefined || typeof raw['danger'] === 'boolean') &&
        (raw['expiresAt'] === undefined ||
          (str(raw['expiresAt']) && Number.isFinite(Date.parse(raw['expiresAt'])))) &&
        (raw['risk'] === undefined || isRisk(raw['risk'])) &&
        (raw['target'] === undefined || isTarget(raw['target'])) &&
        // For R3 the user types the target's name. Without a target the confirm is not drawn.
        (raw['risk'] !== 'R3' || raw['target'] !== undefined) &&
        (raw['undoProposal'] === undefined || typeof raw['undoProposal'] === 'boolean')
        ? (raw as unknown as KnownBlock)
        : null;
    case 'form':
      return str(raw['id']) &&
        str(raw['title']) &&
        str(raw['submitLabel']) &&
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

/** Validates the `ui` field. If it is not an array, returns a single JSON block. */
export function parseBlocks(raw: unknown): GenUIBlock[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) return [{ type: 'unknown', raw }];
  return raw.slice(0, LIMITS.blocks).map(parseBlock);
}
