import type { components } from '@/api/generated/hrms_tr';

export type RecordLocale = 'tr' | 'en';
export type NewRecordContext = components['schemas']['LeaveRequestContextResponse']['message'];
export type PrefillSource = NonNullable<
  NewRecordContext['sources'][keyof NewRecordContext['sources']]
>;

export type Sensitivity = 'standard' | 'restricted';

export type ConditionScope = 'doc' | 'parent';

export type TruthConditionOperator = 'truthy' | 'falsy';

export type ScalarComparisonOperator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte';

export type ConditionOperator = TruthConditionOperator | ScalarComparisonOperator;

export type ScalarConditionValue = string | number | boolean | null;

export type FieldCondition =
  | {
      scope: ConditionScope;
      field: string;
      op: TruthConditionOperator;
    }
  | {
      scope: ConditionScope;
      field: string;
      op: ScalarComparisonOperator;
      value: ScalarConditionValue;
    };

export type UnsupportedConditionKind =
  'depends_on' | 'mandatory_depends_on' | 'read_only_depends_on' | 'collapsible_depends_on';

export interface SelectChoice {
  value: string;
  label: string;
}

export interface DocField {
  fieldname: string;
  fieldtype: string;
  read_only: boolean;
  component: string | null;
  sensitivity: Sensitivity;
  label?: string | null | undefined;
  description?: string | null | undefined;
  options?: string | null | undefined;
  default?: string | null | undefined;
  reqd?: boolean | undefined;
  hidden?: boolean | undefined;
  permlevel?: number | null | undefined;
  depends_on?: FieldCondition | undefined;
  mandatory_depends_on?: FieldCondition | undefined;
  read_only_depends_on?: FieldCondition | undefined;
  fetch_from?: string | null | undefined;
  fetch_if_empty?: boolean | undefined;
  set_only_once?: boolean | undefined;
  unique?: boolean | undefined;
  in_list_view?: boolean | undefined;
  in_standard_filter?: boolean | undefined;
  precision?: string | null | undefined;
  length?: number | null | undefined;
  non_negative?: boolean | undefined;
  collapsible?: boolean | undefined;
  collapsible_depends_on?: FieldCondition | undefined;
  unsupported_conditions?: readonly UnsupportedConditionKind[] | undefined;
  choices?: readonly SelectChoice[] | undefined;
}

/**
 * Yardımcı paneli açma isteği. Form yalnız bu olayı verir. Alan değerini değiştirmez.
 * Öneri kullanıcı onaylayınca ayrı bir değişiklik olarak alana yazılır.
 */
export interface RecordAssistRequest {
  doctype: string;
  fieldname: string;
  label: string;
  value: string;
}

export interface DocTypeSchema {
  name: string;
  module: string | null;
  fields: readonly DocField[];
  title_field: string | null;
  search_fields: string;
  sort_field: string | null;
  sensitivity: Sensitivity;
}

export interface DocTypeMeta {
  schema: DocTypeSchema;
  meta_hash: string;
  perm_version: string;
  child_tables: Readonly<Record<string, DocTypeSchema>>;
  catalog_version: number;
  mobile_cache_allowed: boolean;
  truncated?: true | undefined;
}

export interface SiteFormatting {
  time_zone: string;
  currency: string | null;
  number_format: string;
  rounding_method: string;
  /**
   * BCP 47 tag of the user's region formats. Example: `fr-FR`.
   * Number entry reads the separators from it (AJA-1765). If absent, the language's format locale is used.
   * The boot data does not carry it yet. The real field comes from AJA-1732.
   */
  format_locale?: string | null | undefined;
}

export interface RecordDocument {
  name: string;
  modified?: string | undefined;
  docstatus?: 0 | 1 | 2 | undefined;
  [key: string]: unknown;
}

export interface LinkOption {
  value: string;
  label?: string | undefined;
  description?: string | undefined;
}

export interface LinkSearchParams {
  doctype: string;
  txt: string;
  pageLength?: number | undefined;
  referenceDoctype?: string | undefined;
  linkFieldname?: string | undefined;
  filters?: Readonly<Record<string, unknown>> | undefined;
  signal?: AbortSignal | undefined;
}

export type RecordErrorCode =
  | 'unauthorized'
  | 'session_expired'
  | 'not_found'
  | 'conflict'
  | 'validation'
  | 'rate_limited'
  | 'truncated_meta'
  | 'network'
  | 'invalid_response'
  | 'server_error';

/**
 * Discriminated union for single-record screen state (TS-7, RE-6).
 */
export type RecordScreenState =
  | { status: 'loading' }
  | { status: 'empty'; reason?: 'no_record' | 'not_found' | undefined }
  | { status: 'unauthorized'; reason: 'permission_denied' | 'session_expired' }
  | { status: 'error'; message: string; code: RecordErrorCode }
  | {
      status: 'ready';
      meta: DocTypeMeta;
      record: RecordDocument;
      prefillSources?: Readonly<Record<string, PrefillSource>> | undefined;
    };

export interface RecordConflictInfo {
  message: string;
  attemptedModified: string;
  latestRecord?: RecordDocument | undefined;
}

export interface RecordNavigatorProps {
  currentIndex: number;
  totalCount: number;
  locale?: RecordLocale | undefined;
  disabled?: boolean | undefined;
  hasUnsavedChanges?: boolean | undefined;
  onNavigate?: ((nextIndex: number) => void) | undefined;
}

export interface GetDocTypeMetaParams {
  doctype: string;
  language?: string | undefined;
  etag?: string | undefined;
  signal?: AbortSignal | undefined;
}

export interface GetRecordParams {
  doctype: string;
  name: string;
  signal?: AbortSignal | undefined;
}

export interface SaveRecordParams {
  doctype: string;
  name?: string | undefined;
  modified?: string | undefined;
  data: Readonly<Record<string, unknown>>;
  signal?: AbortSignal | undefined;
}

export interface RunDocActionParams {
  doctype: string;
  name: string;
  action: string;
  modified: string;
  signal?: AbortSignal | undefined;
}

export interface RecordDataAdapter {
  /** Optional for existing adapters. Currently supported for Leave Application only. */
  getNewRecordContext?:
    | ((params: {
        doctype: string;
        signal?: AbortSignal | undefined;
      }) => Promise<NewRecordContext | undefined>)
    | undefined;
  getDocTypeMeta: (params: GetDocTypeMetaParams) => Promise<DocTypeMeta>;
  getRecord: (params: GetRecordParams) => Promise<RecordDocument>;
  saveRecord: (params: SaveRecordParams) => Promise<RecordDocument>;
  searchLink: (params: LinkSearchParams) => Promise<readonly LinkOption[]>;
  runDocAction?: ((params: RunDocActionParams) => Promise<RecordDocument | undefined>) | undefined;
}
