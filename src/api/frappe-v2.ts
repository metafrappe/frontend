// Hand-written types for the Frappe REST API v2 record list endpoint.
//
// This endpoint is not in our OpenAPI contracts. It is a standard Frappe endpoint.
// Orchestrator decision, Monday 23 November 2026: views-collection uses this endpoint for listing and pagination.
// Format verified against the Frappe 16.56.0 source: frappe/api/v2.py `document_list`,
// frappe/api/__init__.py `handle` and the frappe/utils/response.py error format.
// Details and version: src/api/README.md. Re-verify the format when the Frappe version changes.

/** Frappe filter operators. */
export type FilterOperator =
  '=' | '!=' | '>' | '<' | '>=' | '<=' | 'like' | 'not like' | 'in' | 'not in' | 'is' | 'between';

export type FilterScalar = string | number | boolean | null;

/**
 * Filters come in two forms:
 * - object: `{ status: 'Open' }` or `{ amount: ['>', 400] }`,
 * - list: `[['amount', '>', 400]]`.
 */
export type DocumentFilters =
  | Record<string, FilterScalar | [FilterOperator, FilterScalar | FilterScalar[]]>
  | [string, FilterOperator, FilterScalar | FilterScalar[]][];

export interface DocumentListQuery {
  /** Fields to read. If omitted, Frappe returns only `name`. */
  fields?: string[];
  filters?: DocumentFilters;
  /** Example: `modified desc` or `name asc`. */
  orderBy?: string;
  /** Number of records to skip. At least 0. */
  start?: number;
  /** Page size. Between 1 and 100. Default 20. The limit is a project decision (SZ-10). */
  limit?: number;
}

export interface DocumentPage {
  /** Records the user can read. Each record is an object mapping field name to value. */
  data: Record<string, unknown>[];
  /** Is there a next page? Frappe does not return a total count. */
  hasNextPage: boolean;
}

/** Paths type for openapi-fetch. Only the list endpoint is defined. */
export interface FrappeV2Paths {
  '/api/v2/document/{doctype}': {
    parameters: { query?: never; header?: never; path?: never; cookie?: never };
    get: {
      parameters: {
        query?: {
          fields?: string;
          filters?: string;
          order_by?: string;
          start?: number;
          limit?: number;
        };
        header?: never;
        path: { doctype: string };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        200: {
          headers: Record<string, unknown>;
          content: {
            'application/json': { data: Record<string, unknown>[]; has_next_page: boolean };
          };
        };
        default: {
          headers: Record<string, unknown>;
          content: { 'application/json': { errors?: { type: string; message?: string }[] } };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
}
