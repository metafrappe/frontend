/**
 * GenUI block contract (U1).
 *
 * The assistant reply has the shape `{ text, steps, ui[] }`. `ui` is an array of typed blocks.
 * Data from the server is treated as untrusted. `schema.ts` validates every block.
 */

export interface KpiItem {
  label: string;
  value: string;
  delta?: number;
  /** Unit of the change. Example: "%" or "puan". */
  unit?: string;
  /** "down" when a fall is good. Example: return rate. */
  goodWhen?: 'up' | 'down';
}

export interface KpisBlock {
  type: 'kpis';
  items: KpiItem[];
}

export interface ChartBar {
  label: string;
  value: number;
}

export interface ChartBlock {
  type: 'chart';
  title: string;
  bars: ChartBar[];
}

export interface TableColumn {
  key: string;
  title: string;
  /**
   * `id`: identifier or short value. The line does not wrap; the minimum width is kept.
   * `text`: description. Wraps between words. This is the default.
   */
  kind?: 'id' | 'text';
}

export type TableCell = string | number;

export interface TableBlock {
  type: 'table';
  title: string;
  rowKey: string;
  columns: TableColumn[];
  rows: Record<string, TableCell>[];
}

/** One field a write will change. The confirm screen shows its before and after values. */
export interface FieldChange {
  field: string;
  before: string;
  after: string;
}

export interface ConfirmBlock {
  type: 'confirm';
  /**
   * Operation ID. The server binds the approval to this ID.
   * Contract: the server creates a new ID for every new operation.
   * Even if the same question is asked again, the ID is new.
   * An approval is single-use. The same ID is never sent twice.
   */
  id: string;
  title: string;
  /** Summary of the operation. Example: what goes to whom and whether it can be undone. */
  summary: string;
  /** Fields that will change. Cannot be empty. The user never approves without seeing them. */
  changes: FieldChange[];
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  /**
   * Expiry time of the approval, ISO 8601. Example: `2026-11-24T12:00:00+03:00`.
   * After expiry the block shows "Expired" and the approve button is hidden.
   */
  expiresAt?: string;
  /**
   * Risk level. The server assigns the level; the model cannot change it.
   * If no level arrives, the card behaves as R1.
   * - R1: a single "Approve" button.
   * - R2: the button is enabled once the "I have read the preview." box is ticked.
   * - R3: the button is enabled once the user types the `target.name` value by hand.
   */
  risk?: ConfirmRisk;
  /** Target record. `label` shows on the card. At R3 `name` is typed by hand. Required for R3. */
  target?: ConfirmTarget;
  /**
   * `true` when the server advertises the undo-proposal endpoint.
   * Only then does the "Propose undo" button appear after approval.
   * The card never has an "Undo" button. The server has no undo.
   */
  undoProposal?: boolean;
}

/** The confirm card opens only for write operations. An R0 read needs no approval. */
export type ConfirmRisk = Exclude<RiskLevel, 'R0'>;

export interface ConfirmTarget {
  label: string;
  name: string;
}

export interface FormOption {
  value: string;
  label: string;
}

export interface FormField {
  name: string;
  label: string;
  kind: 'text' | 'select' | 'checks';
  options?: FormOption[];
  value?: string | string[];
  required?: boolean;
}

export interface FormBlock {
  type: 'form';
  id: string;
  title: string;
  submitLabel: string;
  cancelLabel?: string;
  fields: FormField[];
}

export interface ChoicesBlock {
  type: 'choices';
  items: string[];
}

/*
 * AI surfaces (AJA-1156). Model document: "Approved component list".
 * Honesty rule: surfaces show no confidence percentage and no model internal reasoning.
 * The schema rejects undefined fields on these surfaces.
 */

/** Assistant mode. The screen shows Ask, Search, Draft or Act. */
export type AssistMode = 'ask' | 'search' | 'draft' | 'act';

/** Scope strip: the tenant, environment, mode and scope the work runs in. */
export interface ScopeBlock {
  type: 'scope';
  tenant: string;
  environment: string;
  mode: AssistMode;
  /** Example: "Human resources, leave requests". */
  scope?: string;
}

/** Status of a tool event. An event is added only when it arrives from the server. */
export type ToolEventStatus = 'running' | 'done' | 'failed';

export interface ToolEvent {
  /** Unique event ID. List order is the order the server sent. */
  id: string;
  /** Tool name. Example: `izin_talebi.oku`. */
  tool: string;
  summary: string;
  status: ToolEventStatus;
}

export interface EventsBlock {
  type: 'events';
  items: ToolEvent[];
}

/** Source. The link starts only with `https://`, `http://` or `/`. */
export interface SourceItem {
  title: string;
  url?: string;
}

/** Source card. If the list is empty the card shows "No sources.". */
export interface SourceBlock {
  type: 'source';
  items: SourceItem[];
}

/** The server assigns the risk level. The model cannot change it. */
export type RiskLevel = 'R0' | 'R1' | 'R2' | 'R3';

/** Change review. Read-only; it has no approve button. */
export interface ReviewBlock {
  type: 'review';
  /** One-sentence summary. */
  summary: string;
  risk: RiskLevel;
  /** Target record. */
  target: string;
  /** Answer to the question "Can it be undone?". */
  reversible: string;
  changes: FieldChange[];
  /** Sources. If none, the screen shows "No sources.". */
  sources?: SourceItem[];
}

export interface QueueItem {
  id: string;
  title: string;
  detail?: string;
  risk: RiskLevel;
}

/** Decision queue: items waiting for the user's decision. Read-only. */
export interface QueueBlock {
  type: 'queue';
  items: QueueItem[];
}

/** The server runs the job once. The outcome is succeeded, failed or unknown. */
export type ResultOutcome = 'succeeded' | 'failed' | 'unknown';

export interface ResultBlock {
  type: 'result';
  outcome: ResultOutcome;
  summary: string;
}

/** Block that failed validation. Shown as JSON if its type is registered, otherwise not drawn. */
export interface UnknownBlock {
  type: 'unknown';
  raw: unknown;
}

export type KnownBlock =
  | KpisBlock
  | ChartBlock
  | TableBlock
  | ConfirmBlock
  | FormBlock
  | ChoicesBlock
  | ScopeBlock
  | EventsBlock
  | SourceBlock
  | ReviewBlock
  | QueueBlock
  | ResultBlock;

export type GenUIBlock = KnownBlock | UnknownBlock;

export type BlockType = KnownBlock['type'];

export type FormValues = Record<string, string | string[]>;

/**
 * Result of an action.
 * - `accepted`: the chat took the decision. The block locks.
 * - `busy`: the chat is busy. The block stays open; the user retries later.
 * - `used`: this approval was already sent. The block locks; the decision is not resent.
 */
export type GenUIActionResult = 'accepted' | 'busy' | 'used';

/** Function that receives the action. */
export type GenUIActionHandler = (action: GenUIAction) => GenUIActionResult;

export type GenUIDecision = 'approved' | 'rejected';

/**
 * Decisions derived from chat history. The key is the block ID.
 * A redrawn block reads its decision from here. Example: after switching chats and back.
 */
export type GenUIDecisions = Readonly<Record<string, GenUIDecision>>;

/**
 * User action emitted by a block.
 * An action is created only when the user presses a button (U4).
 * The chat turns this action into a new user message.
 */
export type GenUIAction =
  | { kind: 'ask'; text: string }
  | { kind: 'confirm'; blockId: string; decision: 'approved' | 'rejected'; title: string }
  | {
      kind: 'form';
      blockId: string;
      decision: 'approved' | 'rejected';
      title: string;
      values?: FormValues;
    };
