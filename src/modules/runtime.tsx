import { Fragment, type ReactNode } from 'react';
import type {
  AiConnectionListing,
  ConnectionCheck,
  ConnectionInput,
  CustomerRequest,
  CustomerRequestInput,
  CustomerStatus,
  ResellerCustomer,
  LinkedAccounts,
  ProviderCatalog,
  SavedConnection,
} from '../api';
import type { BillingClient } from './billing/model';
import { ModuleContext } from './context';

export interface RequestOptions {
  signal?: AbortSignal;
}
/** Normalized, schema-checked results from the shared API client. No fetch or session logic lives here. */
export interface ModuleClient {
  getProfile?: (options: RequestOptions) => Promise<unknown>;
  listLeaveApplications?: (
    query: { limit_start: number; limit_page_length: number; order_by: 'modified desc, name asc' },
    options: RequestOptions,
  ) => Promise<unknown>;
  getLeaveApplication?: (name: string, options: RequestOptions) => Promise<unknown>;
  approveLeaveApplication?: (
    body: { name: string; version: string },
    options: RequestOptions,
  ) => Promise<unknown>;
  cancelLeaveApplication?: (
    body: { name: string; version: string },
    options: RequestOptions,
  ) => Promise<unknown>;
  explainPermission?: (
    query: {
      doctype: string;
      name: string;
      ptype: 'read' | 'write' | 'create' | 'delete' | 'submit' | 'cancel';
    },
    options: RequestOptions,
  ) => Promise<unknown>;
  /** G-62 ve G-98: rol, izin satırı, kullanıcı izni, erişim kuralı ve değişiklik kaydı uçları. */
  admin?: AdminClient;
  listProposals?: (
    query: { limit: number; start: number },
    options: RequestOptions,
  ) => Promise<unknown>;
  getProposal?: (id: string, options: RequestOptions) => Promise<unknown>;
  approveProposal?: (id: string, digest: string, options: RequestOptions) => Promise<unknown>;
  rejectProposal?: (id: string, options: RequestOptions) => Promise<unknown>;
  /**
   * AtonotA Login bağlı hesap istemcisini yükler (G-160). İstemci kodu ilk yüke girmez;
   * yalnız hesap sayfasının "Bağlı hesaplar" bölümü çağırınca iner.
   */
  linkedAccounts?: () => Promise<LinkedAccountsClient>;
  /**
   * Yapay zekâ sağlayıcı istemcisini yükler: katalog, bağlantı listesi, kayıt ve deneme.
   * İstemci kodu ilk yüke girmez; yalnız "Yapay zekâ sağlayıcıları" sayfası çağırınca iner.
   */
  aiProviders?: () => Promise<AiProviderClient>;
  /**
   * Bayi istemcisini yükler (G-169, G-170). İstemci kodu ilk yüke girmez;
   * yalnız "Müşteriler" sayfası çağırınca iner.
   */
  resellers?: () => Promise<ResellerClient>;
  /**
   * Kullanıcı yönetimi istemcisini yükler (G-98): kullanıcı listesi, davet ve rol profili.
   * İstemci kodu ilk yüke girmez; yalnız "Yönetim" sayfası çağırınca iner.
   */
  userAdmin?: () => Promise<UserAdminClient>;
  /**
   * Fatura ve koşul kabul istemcisini yükler (AJA-1785). İstemci kodu ilk yüke girmez;
   * yalnız "Fatura bilgileri" sayfası çağırınca iner.
   */
  billing?: () => Promise<BillingClient>;
}
/** Bayi uçları. Ortak istemci yanıtları sözleşmeyle denetler. Yetkiyi sunucu denetler. */
export interface ResellerClient {
  listCustomers: (options: RequestOptions) => Promise<ResellerCustomer[]>;
  customerStatus: (tenant: string, options: RequestOptions) => Promise<CustomerStatus>;
  requestCustomer: (
    input: CustomerRequestInput,
    options: RequestOptions,
  ) => Promise<CustomerRequest>;
}
/** Kiracının bir kullanıcısı. Ad, Frappe kullanıcı kimliğidir (e-posta). */
export interface TenantUser {
  name: string;
  fullName: string;
  enabled: boolean;
  lastLogin: string | null;
}
/** Rol profili ve roller sunucu bu alanları gizlerse yoktur. Boş liste "profil yok" demektir. */
export interface UserRecord extends TenantUser {
  roleProfiles?: string[];
  roles?: string[];
}
export interface InviteInput {
  email: string;
  firstName: string;
  lastName: string;
}
export interface InvitePreview {
  digest: string;
  operations: { operation: string; target?: string; destructive: boolean }[];
}
/** Kullanıcı yönetimi uçları. Sunucu her istekte rolü yeniden denetler. */
export interface UserAdminClient {
  listUsers: (
    query: { start: number },
    options?: RequestOptions,
  ) => Promise<{ users: TenantUser[]; hasNext: boolean }>;
  getUser: (name: string, options?: RequestOptions) => Promise<UserRecord>;
  listRoleProfiles: (options?: RequestOptions) => Promise<string[]>;
  getRoleProfile: (
    name: string,
    options?: RequestOptions,
  ) => Promise<{ name: string; roles: string[] }>;
  /** Önizleme yalnız okur. Dönen özet, gönderme isteğinin onayıdır. */
  previewInvite: (input: InviteInput, options?: RequestOptions) => Promise<InvitePreview>;
  sendInvite: (input: InviteInput, digest: string, options?: RequestOptions) => Promise<void>;
  setRoleProfiles: (
    user: string,
    roleProfiles: string[],
    options?: RequestOptions,
  ) => Promise<{ roleProfiles: string[]; roles: string[] }>;
}
export type { AiConnectionListing };
/**
 * Yönetim sayfasının rol ve yetki uçları. Ortak istemci yanıtı açar. Sayfa alanları
 * `../contracts` ayrıştırıcılarıyla denetler. Sunucu her istekte yetkiyi yeniden denetler.
 */
export interface AdminClient {
  listRoles: (options: RequestOptions) => Promise<unknown>;
  listRolePermissions: (doctype: string, options: RequestOptions) => Promise<unknown>;
  setRolePermission: (
    body: {
      doctype: string;
      role: string;
      permlevel: number;
      permissions: Record<string, boolean>;
    },
    options: RequestOptions,
  ) => Promise<unknown>;
  listPermissionLogs: (
    query: { start: number; page_length: number },
    options: RequestOptions,
  ) => Promise<unknown>;
  listUserPermissions: (options: RequestOptions) => Promise<unknown>;
  createUserPermission: (
    values: Record<string, string | number>,
    options: RequestOptions,
  ) => Promise<unknown>;
  deleteUserPermission: (name: string, options: RequestOptions) => Promise<unknown>;
  listAccessRules: (options: RequestOptions) => Promise<unknown>;
  createAccessRule: (
    values: Record<string, string | number>,
    options: RequestOptions,
  ) => Promise<unknown>;
}
/** Bağlı hesap uçları. Ortak istemci yanıtları sözleşmeyle denetler. */
export interface LinkedAccountsClient {
  listLinkedAccounts: (options: RequestOptions) => Promise<LinkedAccounts>;
  /** Bir platform bağını kaldırır. Son giriş yolunda sunucu 409 `LastSignInMethod` döner. */
  unlinkAccount: (provider: string, options: RequestOptions) => Promise<LinkedAccounts>;
}
/** Sayfanın kullandığı sağlayıcı uçları. Ortak istemci yanıtları sözleşmeyle denetler. */
export interface AiProviderClient {
  listProviderCatalog: (options: RequestOptions) => Promise<ProviderCatalog>;
  /** Satırlar ham kayıttır. Sayfa yalnız bilinen alanları okur. Parola alanı istenmez. */
  listAiConnections: (options: RequestOptions) => Promise<AiConnectionListing>;
  saveProviderConnection: (
    input: ConnectionInput,
    options: RequestOptions,
  ) => Promise<SavedConnection>;
  checkProviderConnection: (api: string, options: RequestOptions) => Promise<ConnectionCheck>;
}
export interface ModuleEnvironment {
  tenant: string;
  user: string;
  mode: 'example' | 'live';
  locale?: 'en' | 'tr';
  client?: ModuleClient;
  profile?: { fullName: string; roles: readonly string[]; truncated?: boolean };
  /** Realm URL comes from validated auth configuration, never from an arbitrary query string. */
  identityRealmUrl?: string;
  accountSecurityUrl?: string;
  pressOrigin?: string;
  /** Only a trusted server state, never a URL query or local success guess. */
  accountDeletionStatus?: unknown;
}
export function ModuleProvider({
  value,
  children,
}: {
  value: ModuleEnvironment;
  children: ReactNode;
}) {
  // Account changes discard all drafts, approvals and in-flight results together.
  return (
    <ModuleContext.Provider value={value}>
      <Fragment key={JSON.stringify([value.tenant, value.user, value.mode])}>{children}</Fragment>
    </ModuleContext.Provider>
  );
}
