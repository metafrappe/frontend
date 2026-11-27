// Reseller client: linked customers, site status and new customer requests (G-169, G-170).
//
// This file is not part of the initial load. The Customers page loads it with `import()`.
// Requests go through the shared client: `frappeDocument` handles the site origin, CSRF header,
// timeout and session expiry.
//
// The endpoints are in the `platform_core.api.reseller` module. The response shape is the contract of the AJA-831 tests:
// - `list_customers` (GET): a list of rows. Each row has `customer_tenant`.
// - `customer_status` (GET, `customer_tenant`): `customer_tenant` and `status`.
// - `request_customer` (POST, `customer_name`, `contact_email`): the request's `name` value.
// The server checks permissions. Example: if a "Reseller Assistant" sends a request, the server returns 403.
import type { ApiClient, RequestOptions } from './client';
import type { Guard } from './guards';
import { ApiError } from './index';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const MAX_CUSTOMERS = 500;
const MAX_TEXT = 140;

const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= MAX_TEXT;

export interface ResellerCustomer {
  /** Site name of the customer tenant. Example: `musteri-a.example.test`. */
  customer_tenant: string;
}

export interface CustomerStatus {
  customer_tenant: string;
  /** Site status. Example: `active`. The page shows an unknown value as is. */
  status: string;
}

export interface CustomerRequestInput {
  customer_name: string;
  contact_email: string;
}

export interface CustomerRequest {
  /** ID of the created request. */
  name: string;
}

const isCustomer = (value: unknown): value is ResellerCustomer =>
  isRecord(value) && isText(value.customer_tenant);

export const isCustomerList: Guard<ResellerCustomer[]> = (value): value is ResellerCustomer[] =>
  Array.isArray(value) &&
  value.length <= MAX_CUSTOMERS &&
  value.every(isCustomer) &&
  new Set(value.map((row) => row.customer_tenant)).size === value.length;

export const isCustomerStatus: Guard<CustomerStatus> = (value): value is CustomerStatus =>
  isRecord(value) && isText(value.customer_tenant) && isText(value.status);

export const isCustomerRequest: Guard<CustomerRequest> = (value): value is CustomerRequest =>
  isRecord(value) && isText(value.name);

const METHOD = '/api/method/platform_core.api.reseller.';

export function createResellerClient(api: Pick<ApiClient, 'frappeDocument'>) {
  async function call<T>(
    request: {
      method: 'GET' | 'POST';
      name: string;
      query?: Record<string, string>;
      body?: object;
    },
    guard: Guard<T>,
    options: RequestOptions,
  ): Promise<T> {
    const response = await api.frappeDocument({
      method: request.method,
      path: `${METHOD}${request.name}`,
      ...(request.query ? { query: request.query } : {}),
      ...(request.body ? { body: request.body } : {}),
      ...(options.signal ? { signal: options.signal } : {}),
    });
    if (!response.ok) throw response.error;
    const value = isRecord(response.body) ? response.body.message : undefined;
    if (!guard(value)) throw new ApiError({ kind: 'invalid_response', status: response.status });
    return value;
  }

  return {
    /** The reseller's linked customers. The server returns only tenants linked to this reseller. */
    listCustomers(options: RequestOptions = {}): Promise<ResellerCustomer[]> {
      return call({ method: 'GET', name: 'list_customers' }, isCustomerList, options);
    },

    /** A customer's site status. For another reseller's customer the server returns 403. */
    async customerStatus(tenant: string, options: RequestOptions = {}): Promise<CustomerStatus> {
      const status = await call(
        { method: 'GET', name: 'customer_status', query: { customer_tenant: tenant } },
        isCustomerStatus,
        options,
      );
      if (status.customer_tenant !== tenant)
        throw new ApiError({ kind: 'invalid_response', status: 200 });
      return status;
    },

    /** Opens a new customer request. A "Platform Operator" approves the request. */
    requestCustomer(
      input: CustomerRequestInput,
      options: RequestOptions = {},
    ): Promise<CustomerRequest> {
      return call(
        { method: 'POST', name: 'request_customer', body: { ...input } },
        isCustomerRequest,
        options,
      );
    },
  };
}

export type ResellerClient = ReturnType<typeof createResellerClient>;
