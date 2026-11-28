// Bu klasörün sahibi `api-client` işidir.
export { createApiClient } from './client';
export { appendUnique, createLatestRequest, scopedKey } from './request-order';
export type { LatestTicket } from './request-order';
export type {
  ApiClient,
  ApiClientDeps,
  DocTypeResult,
  DocumentRequest,
  DocumentResponse,
  JsonRpcRequest,
  RequestOptions,
} from './client';
export { readApiConfig, DEFAULT_KEYCLOAK_REALM, DEFAULT_KEYCLOAK_URL } from './config';
export type { ApiConfig, ApiEnv } from './config';
export { createCsrfStore, readCsrfFromDocument } from './csrf';
export type { CsrfStore } from './csrf';
export { ApiError, toApiError, userMessage } from './errors';
export type { ApiErrorKind, MessageLocale } from './errors';
export type {
  ApprovalOutcome,
  Bootstrap,
  CompletionRequest,
  CompletionResult,
  DocTypeMeta,
  LoginUrl,
  LogoutUrl,
  Proposal,
} from './guards';
export { createAgentRequest } from './ai-agent';
export type {
  AgentCallbacks,
  AgentDeps,
  AgentInput,
  AssistantReply,
  ChatMessage,
  ConfirmBlock,
  UiBlock,
} from './ai-agent';
export type { McpResult } from './client';
export type {
  ExplainPermissionQuery,
  LeaveListQuery,
  PermissionLogQuery,
  RolePermissionChange,
} from './client';
export type {
  AccessScope,
  AccessSummary,
  HomeCounts,
  HomeProblem,
  HomeSummary,
  LeaveApplication,
  LeaveName,
  PermissionExplanation,
  PendingApproval,
  PermissionType,
  RecentChange,
} from './guards';
export { pressAccountDeletionUrl, readPressConfig } from './press';
export type { PressConfig, PressEnv } from './press';
export type { Installation, InstallationPage, Revoked } from './guards';
export { PROVIDER_ALIAS_PATTERN, isProviderAlias } from './guards';
export type { LinkedAccounts, LinkedProvider, LoginClient, LoginProvider } from './login-client';
export type {
  DocumentFilters,
  DocumentListQuery,
  DocumentPage,
  FilterOperator,
  FilterScalar,
} from './frappe-v2';
export type { GroupSummary, GroupSummaryFilters, GroupSummaryQuery } from './group-summary';
export type {
  ConnectionCheck,
  ConnectionInput,
  ConnectionStatus,
  ProviderCatalog,
  ProviderDefinition,
  ProviderFieldDefinition,
  SavedConnection,
  AiConnectionListing,
  ProviderClient,
} from './provider-client';
// Bayi istemcisinin tipleri. Kod ayrı parçadadır: `reseller-client.ts` yalnız "Müşteriler" sayfasında iner.
export type {
  CustomerRequest,
  CustomerRequestInput,
  CustomerStatus,
  ResellerCustomer,
} from './reseller-client';
