// Functions that check responses before they reach the screen (SZ-4, TS-5).
// External data is treated as `unknown`. Only the fields in use are checked.
import type { components as HrmsComponents } from './generated/hrms_tr';
import type { components as AccessComponents } from './generated/platform_core-access';
import type { components as AiComponents } from './generated/platform_core-ai';
import type { components as MobileComponents } from './generated/platform_core-mobile';
import type { components as IdentityComponents } from './generated/platform_core-identity';
import type { components as GatewayComponents } from './generated/platform_core-model-gateway';
import type { components as ShellComponents } from './generated/platform_core-shell';

export type LoginUrl = IdentityComponents['schemas']['LoginUrl'];
export type LogoutUrl = IdentityComponents['schemas']['LogoutUrl'];
export type Bootstrap = ShellComponents['schemas']['Bootstrap'];
export type DocTypeMeta = ShellComponents['schemas']['Meta'];
export type Proposal = AiComponents['schemas']['Proposal'];
export type ApprovalOutcome = AiComponents['schemas']['ApprovalOutcome'];
export type CompletionRequest = GatewayComponents['schemas']['Completion'];
export type CompletionResult = GatewayComponents['schemas']['Result'];
export type JsonRpcResponse = AiComponents['schemas']['JsonRpcResponse'];

export type Guard<T> = (value: unknown) => value is T;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

/** Unwraps the Frappe response envelope: `{ "message": ... }`. */
export function readMessage(body: unknown): unknown {
  return isRecord(body) ? body.message : undefined;
}

export const isUserName: Guard<string> = (value): value is string =>
  isString(value) && value.length > 0;

export const isLoginUrl: Guard<LoginUrl> = (value): value is LoginUrl =>
  isRecord(value) &&
  isString(value.login_url) &&
  isString(value.brand_name) &&
  isString(value.label);

export const isLogoutUrl: Guard<LogoutUrl> = (value): value is LogoutUrl =>
  isRecord(value) && isString(value.logout_url);

function isOptional(value: unknown, check: (item: unknown) => boolean): boolean {
  return value === undefined || check(value);
}

function isNullable(check: (item: unknown) => boolean) {
  return (value: unknown) => value === null || check(value);
}

const isFlag = isNullable((value) => typeof value === 'number' || typeof value === 'boolean');
const isNullableNumber = isNullable((value) => typeof value === 'number');
const isFilterValue = isNullable(
  (value) => typeof value === 'string' || Array.isArray(value) || isRecord(value),
);

const SIDEBAR_ITEM_TEXT = ['icon', 'label', 'link_to', 'link_type', 'tab', 'type', 'url'];
const SIDEBAR_ITEM_FLAGS = [
  'child',
  'collapsible',
  'derived',
  'hidden',
  'is_default_module',
  'keep_closed',
  'open_in_new_tab',
  'show_arrow',
];

function isSidebarItem(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    SIDEBAR_ITEM_TEXT.every((key) => isOptional(value[key], isNullableString)) &&
    SIDEBAR_ITEM_FLAGS.every((key) => isOptional(value[key], isFlag)) &&
    isOptional(value.key, isString) &&
    isOptional(value.indent, isNullableNumber) &&
    isOptional(value.filters, isFilterValue) &&
    isOptional(value.route_options, isFilterValue) &&
    isOptional(
      value.report,
      (report) =>
        isRecord(report) &&
        isOptional(report.ref_doctype, isNullableString) &&
        isOptional(report.report_type, isNullableString),
    )
  );
}

function isSidebar(value: unknown): boolean {
  if (!isRecord(value) || !isString(value.name) || !isRecord(value.data)) return false;
  const data = value.data;
  return (
    ['app', 'header_icon', 'module', 'module_onboarding'].every((key) =>
      isOptional(data[key], isNullableString),
    ) &&
    ['computed', 'customized'].every((key) => isOptional(data[key], isFlag)) &&
    isOptional(data.label, isString) &&
    isOptional(data.name, isString) &&
    isOptional(data.workspaces, isStringArray) &&
    isOptional(data.items, (items) => Array.isArray(items) && items.every(isSidebarItem))
  );
}

function isWorkspace(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.name) &&
    isString(value.title) &&
    isNullableString(value.app) &&
    isNullableString(value.icon) &&
    isNullableString(value.module) &&
    isNullableString(value.parent_page)
  );
}

function isFormatting(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNullableString(value.currency) &&
    isString(value.number_format) &&
    isString(value.rounding_method) &&
    isString(value.time_zone)
  );
}

/** Checks the boot data together with its list items. If the menu is malformed, the response is rejected. */
export const isBootstrap: Guard<Bootstrap> = (value): value is Bootstrap => {
  if (!isRecord(value)) return false;
  const { user } = value;
  return (
    isRecord(user) &&
    isString(user.name) &&
    isString(user.full_name) &&
    isString(user.language) &&
    isStringArray(user.roles) &&
    isFormatting(value.formatting) &&
    isStringArray(value.installed_apps) &&
    Array.isArray(value.sidebars) &&
    value.sidebars.every(isSidebar) &&
    Array.isArray(value.workspaces) &&
    value.workspaces.every(isWorkspace) &&
    isString(value.meta_hash) &&
    isString(value.perm_version) &&
    isOptional(value.truncated, (flag) => flag === true)
  );
};

function isDocTypeSchema(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    isString(value.name) &&
    (value.sensitivity === 'standard' || value.sensitivity === 'restricted') &&
    Array.isArray(value.fields) &&
    value.fields.every(
      (field) =>
        isRecord(field) &&
        isString(field.fieldname) &&
        isString(field.fieldtype) &&
        isNullableString(field.component) &&
        typeof field.read_only === 'boolean' &&
        (field.sensitivity === 'standard' || field.sensitivity === 'restricted'),
    )
  );
}

export const isDocTypeMeta: Guard<DocTypeMeta> = (value): value is DocTypeMeta =>
  isRecord(value) &&
  isDocTypeSchema(value.schema) &&
  isRecord(value.child_tables) &&
  Object.values(value.child_tables).every(isDocTypeSchema) &&
  typeof value.catalog_version === 'number' &&
  isString(value.meta_hash) &&
  isString(value.perm_version) &&
  typeof value.mobile_cache_allowed === 'boolean';

const PROPOSAL_STATUSES = new Set(['pending', 'rejected', 'expired', 'consumed']);
const PROPOSAL_RESULTS = new Set(['', 'unknown', 'succeeded', 'failed']);
const PREVIEW_ACTIONS = new Set([
  'create',
  'update',
  'submit',
  'cancel',
  'delete',
  'app_tool',
  'admin',
]);

export function isPreview(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.action) &&
    PREVIEW_ACTIONS.has(value.action) &&
    isString(value.summary) &&
    (value.changes === undefined ||
      (Array.isArray(value.changes) &&
        value.changes.every(
          (change) => isRecord(change) && isString(change.fieldname) && 'new' in change,
        )))
  );
}

export const isProposal: Guard<Proposal> = (value): value is Proposal =>
  isRecord(value) &&
  isString(value.proposal_id) &&
  isString(value.status) &&
  PROPOSAL_STATUSES.has(value.status) &&
  isString(value.result) &&
  PROPOSAL_RESULTS.has(value.result) &&
  isString(value.tool) &&
  typeof value.destructive === 'boolean' &&
  typeof value.billable === 'boolean' &&
  isPreview(value.preview) &&
  isString(value.digest) &&
  /^[0-9a-f]{64}$/.test(value.digest) &&
  isString(value.expires_at) &&
  isString(value.created_at);

export const isProposalList: Guard<{ proposals: Proposal[]; has_next_page: boolean }> = (
  value,
): value is { proposals: Proposal[]; has_next_page: boolean } =>
  isRecord(value) &&
  Array.isArray(value.proposals) &&
  value.proposals.every(isProposal) &&
  typeof value.has_next_page === 'boolean';

export const isApprovalOutcome: Guard<ApprovalOutcome> = (value): value is ApprovalOutcome =>
  isRecord(value) &&
  typeof value.executed === 'boolean' &&
  (value.deny_reason === undefined || isNullableString(value.deny_reason)) &&
  isProposal(value.proposal);

export const isCompletionResult: Guard<CompletionResult> = (value): value is CompletionResult =>
  isRecord(value) &&
  isString(value.text) &&
  Array.isArray(value.tool_calls) &&
  value.tool_calls.every(
    (call) =>
      isRecord(call) && isString(call.id) && isString(call.name) && isRecord(call.arguments),
  ) &&
  isRecord(value.usage) &&
  isString(value.model) &&
  isString(value.api);

export const isJsonRpcResponse: Guard<JsonRpcResponse> = (value): value is JsonRpcResponse =>
  isRecord(value) &&
  value.jsonrpc === '2.0' &&
  (value.result === undefined || isRecord(value.result)) &&
  (value.error === undefined ||
    (isRecord(value.error) &&
      typeof value.error.code === 'number' &&
      isString(value.error.message)));

// HRMS leave applications (hrms_tr contract).
export type LeaveApplication = HrmsComponents['schemas']['LeaveApplication'];
export type LeaveName = HrmsComponents['schemas']['LeaveName'];

const LEAVE_STATUSES = new Set(['Open', 'Approved', 'Rejected', 'Cancelled']);
const LEAVE_TEXT_FIELDS = [
  'employee',
  'employee_name',
  'company',
  'leave_approver',
  'leave_type',
  'from_date',
  'to_date',
  'description',
  'amended_from',
];

export const isLeaveApplication: Guard<LeaveApplication> = (value): value is LeaveApplication =>
  isRecord(value) &&
  isString(value.name) &&
  LEAVE_TEXT_FIELDS.every((key) => isOptional(value[key], isNullableString)) &&
  isOptional(
    value.status,
    (status) => status === null || (isString(status) && LEAVE_STATUSES.has(status)),
  ) &&
  isOptional(
    value.docstatus,
    (docstatus) => docstatus === 0 || docstatus === 1 || docstatus === 2,
  ) &&
  isOptional(value.modified, isString) &&
  isOptional(value.total_leave_days, isNullableNumber) &&
  isOptional(value.leave_balance, isNullableNumber);

export const isLeaveList: Guard<LeaveApplication[]> = (value): value is LeaveApplication[] =>
  Array.isArray(value) && value.every(isLeaveApplication);

export const isLeaveName: Guard<LeaveName> = (value): value is LeaveName =>
  isRecord(value) && isString(value.name) && value.name.length > 0;

// Home page summary (hrms_tr contract, `get_home_summary`).
export type HomeSummary = HrmsComponents['schemas']['HomeSummary'];
export type PendingApproval = HrmsComponents['schemas']['PendingApproval'];
export type HomeProblem = HrmsComponents['schemas']['HomeProblem'];
export type RecentChange = HrmsComponents['schemas']['RecentChange'];
export type HomeCounts = HrmsComponents['schemas']['HomeCounts'];

const RECENT_ACTIONS = new Set(['created', 'updated', 'approved', 'rejected', 'cancelled']);
const HOME_COUNT_KEYS = ['pending_approvals', 'on_leave_today', 'opened_this_month', 'problems'];

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function isListOf(value: unknown, max: number, check: (item: unknown) => boolean): boolean {
  return Array.isArray(value) && value.length <= max && value.every(check);
}

function isCount(value: unknown): boolean {
  return Number.isInteger(value) && (value as number) >= 0;
}

function isPendingApproval(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      'name',
      'version',
      'employee_name',
      'leave_type',
      'from_date',
      'to_date',
      'total_leave_days',
      'leave_balance',
    ]) &&
    isString(value.name) &&
    isString(value.version) &&
    isNullableString(value.employee_name) &&
    isNullableString(value.leave_type) &&
    isNullableString(value.from_date) &&
    isNullableString(value.to_date) &&
    isNullableNumber(value.total_leave_days) &&
    isNullableNumber(value.leave_balance)
  );
}

function isOverlapLeave(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ['name', 'employee_name', 'from_date', 'to_date']) &&
    isString(value.name) &&
    isNullableString(value.employee_name) &&
    isString(value.from_date) &&
    isString(value.to_date)
  );
}

function isHomeProblem(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (value.kind === 'overlap') {
    return (
      hasOnlyKeys(value, ['kind', 'department', 'leaves']) &&
      isString(value.department) &&
      Array.isArray(value.leaves) &&
      value.leaves.length === 2 &&
      value.leaves.every(isOverlapLeave)
    );
  }
  if (value.kind === 'missing_joining_date') {
    return (
      hasOnlyKeys(value, ['kind', 'employee', 'employee_name']) &&
      isString(value.employee) &&
      isNullableString(value.employee_name)
    );
  }
  return false;
}

function isRecentChange(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ['name', 'employee_name', 'actor', 'action', 'at']) &&
    isString(value.name) &&
    isNullableString(value.employee_name) &&
    isString(value.actor) &&
    isString(value.action) &&
    RECENT_ACTIONS.has(value.action) &&
    isString(value.at)
  );
}

function isHomeCounts(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, HOME_COUNT_KEYS) &&
    HOME_COUNT_KEYS.every((key) => isCount(value[key]))
  );
}

/** Checks the home page summary. All four parts are required. List limits come from the contract. */
export const isHomeSummary: Guard<HomeSummary> = (value): value is HomeSummary =>
  isRecord(value) &&
  hasOnlyKeys(value, ['pending_approvals', 'problems', 'recent_changes', 'counts']) &&
  isListOf(value.pending_approvals, 50, isPendingApproval) &&
  isListOf(value.problems, 50, isHomeProblem) &&
  isListOf(value.recent_changes, 5, isRecentChange) &&
  isHomeCounts(value.counts);

// Access rule engine (platform_core-access contract).
export type AccessScope = AccessComponents['schemas']['Scope'];
export type PermissionExplanation = AccessComponents['schemas']['Explanation'];
export type AccessSummary = AccessComponents['schemas']['AccessSummary'];
export type PermissionType = PermissionExplanation['ptype'];

const SCOPES = new Set(['own', 'team', 'department', 'company', 'all']);
const PERMISSION_TYPES = ['read', 'write', 'create', 'delete', 'submit', 'cancel'];
const EXPLANATION_REASONS = new Set([
  'allowed',
  'allowed_by_share',
  'no_role_permission',
  'no_matching_rule',
  'user_permission',
  'not_permitted_or_missing',
]);

function isScope(value: unknown): boolean {
  return isString(value) && SCOPES.has(value);
}

export const isPermissionExplanation: Guard<PermissionExplanation> = (
  value,
): value is PermissionExplanation =>
  isRecord(value) &&
  isString(value.doctype) &&
  isString(value.name) &&
  isString(value.ptype) &&
  PERMISSION_TYPES.includes(value.ptype) &&
  isString(value.user) &&
  typeof value.allowed === 'boolean' &&
  isString(value.reason) &&
  EXPLANATION_REASONS.has(value.reason) &&
  typeof value.governed === 'boolean' &&
  isRecord(value.layers) &&
  typeof value.layers.role === 'boolean' &&
  typeof value.layers.access_rule === 'boolean' &&
  typeof value.layers.share === 'boolean' &&
  Array.isArray(value.rules) &&
  value.rules.every(
    (rule) =>
      isRecord(rule) &&
      isString(rule.name) &&
      isString(rule.title) &&
      isString(rule.role) &&
      isScope(rule.scope) &&
      typeof rule.applies === 'boolean' &&
      typeof rule.matches === 'boolean',
  );

export const isAccessSummary: Guard<AccessSummary> = (value): value is AccessSummary => {
  if (!isRecord(value) || !isString(value.doctype) || typeof value.governed !== 'boolean') {
    return false;
  }
  const operations = value.operations;
  return (
    isRecord(operations) &&
    Object.keys(operations).every((key) => PERMISSION_TYPES.includes(key)) &&
    PERMISSION_TYPES.every(
      (key) => Array.isArray(operations[key]) && (operations[key] as unknown[]).every(isScope),
    )
  );
};

// Device installations (platform_core-mobile contract, PWA session).
export type Revoked = MobileComponents['schemas']['Revoked'];

export interface Installation {
  installation_id: string;
  scope: 'mobile' | 'pwa';
  revoked: boolean;
}

export interface InstallationPage {
  installations: Installation[];
  next_after: string | null;
}

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function isUuid(value: unknown): value is string {
  return isString(value) && UUID_PATTERN.test(value);
}

export const isInstallationPage: Guard<InstallationPage> = (value): value is InstallationPage =>
  isRecord(value) &&
  Array.isArray(value.installations) &&
  value.installations.length <= 20 &&
  value.installations.every(
    (item) =>
      isRecord(item) &&
      isUuid(item.installation_id) &&
      (item.scope === 'mobile' || item.scope === 'pwa') &&
      typeof item.revoked === 'boolean',
  ) &&
  (value.next_after === null || isUuid(value.next_after));

export const isRevoked: Guard<Revoked> = (value): value is Revoked =>
  isRecord(value) &&
  typeof value.revoked === 'number' &&
  Number.isInteger(value.revoked) &&
  value.revoked >= 0;

// Frappe API v2 record list (src/api/frappe-v2.ts).
export interface RawDocumentPage {
  data: Record<string, unknown>[];
  has_next_page: boolean;
}

export const isRawDocumentPage: Guard<RawDocumentPage> = (value): value is RawDocumentPage =>
  isRecord(value) &&
  Array.isArray(value.data) &&
  value.data.every(isRecord) &&
  typeof value.has_next_page === 'boolean';

// AtonotA Login: platform name rule (G-159). The list and linked-account checks are in a separate chunk:
// `login-client.ts`. This rule is small; the code that builds the sign-in URL also uses it.

/**
 * Platform name (Keycloak identity provider alias). Example: `google`.
 * The name is checked against this rule before it is put in a URL (GV-3).
 */
export const PROVIDER_ALIAS_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export function isProviderAlias(value: unknown): value is string {
  return typeof value === 'string' && PROVIDER_ALIAS_PATTERN.test(value);
}
