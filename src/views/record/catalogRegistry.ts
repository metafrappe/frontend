import type { DocField } from './types';
import { foldCode } from '@/app/locale/code';

export const CATALOG_VERSION = 2;
export const SUPPORTED_CATALOG_VERSIONS = [1, 2] as const;

export type CatalogEntryKind = 'field' | 'layout' | 'standalone' | 'unsupported';

export interface CatalogEntry {
  readonly supported: boolean;
  readonly kind: CatalogEntryKind;
  readonly canonicalType: string;
  readonly minCatalogVersion: number;
  readonly allowedComponents: readonly string[];
}

function normalizeComponentKey(key: string): string {
  return foldCode(key).replace(/_/g, '-');
}

const CATALOG_DEFINITIONS: Readonly<Record<string, Omit<CatalogEntry, 'supported'>>> = {
  Data: {
    kind: 'field',
    canonicalType: 'Data',
    minCatalogVersion: 1,
    allowedComponents: ['input', 'data', 'text-input', 'email', 'url', 'phone'],
  },
  Phone: {
    kind: 'field',
    canonicalType: 'Phone',
    minCatalogVersion: 1,
    allowedComponents: ['phone', 'input', 'data'],
  },
  Autocomplete: {
    kind: 'field',
    canonicalType: 'Autocomplete',
    minCatalogVersion: 1,
    allowedComponents: ['autocomplete', 'select', 'input'],
  },
  Int: {
    kind: 'field',
    canonicalType: 'Int',
    minCatalogVersion: 1,
    allowedComponents: ['int', 'integer', 'number', 'input-number'],
  },
  Float: {
    kind: 'field',
    canonicalType: 'Float',
    minCatalogVersion: 1,
    allowedComponents: ['float', 'decimal', 'number', 'input-number'],
  },
  Currency: {
    kind: 'field',
    canonicalType: 'Currency',
    minCatalogVersion: 1,
    allowedComponents: ['currency', 'number', 'input-number'],
  },
  Percent: {
    kind: 'field',
    canonicalType: 'Percent',
    minCatalogVersion: 1,
    allowedComponents: ['percent', 'float', 'number', 'input-number'],
  },
  Check: {
    kind: 'field',
    canonicalType: 'Check',
    minCatalogVersion: 1,
    allowedComponents: ['check', 'checkbox', 'boolean', 'switch'],
  },
  Select: {
    kind: 'field',
    canonicalType: 'Select',
    minCatalogVersion: 1,
    allowedComponents: ['select'],
  },
  Link: {
    kind: 'field',
    canonicalType: 'Link',
    minCatalogVersion: 1,
    // Arka uç `link-select` adını yollar (frappesetup backend: platform_core/shell/catalog.py).
    allowedComponents: ['link', 'link-select', 'select'],
  },
  'Dynamic Link': {
    kind: 'field',
    canonicalType: 'Dynamic Link',
    minCatalogVersion: 1,
    // Bilerek `link-select` yok: arka ucun Dynamic Link alanı bu işte desteklenmeyen alan kalır.
    allowedComponents: ['dynamic-link', 'link', 'select'],
  },
  Date: {
    kind: 'field',
    canonicalType: 'Date',
    minCatalogVersion: 1,
    allowedComponents: ['date', 'date-picker', 'input'],
  },
  Datetime: {
    kind: 'field',
    canonicalType: 'Datetime',
    minCatalogVersion: 1,
    allowedComponents: ['datetime', 'datetime-picker', 'input'],
  },
  Time: {
    kind: 'field',
    canonicalType: 'Time',
    minCatalogVersion: 1,
    allowedComponents: ['time', 'time-picker', 'input'],
  },
  Duration: {
    kind: 'field',
    canonicalType: 'Duration',
    minCatalogVersion: 1,
    allowedComponents: ['duration', 'int', 'number', 'input'],
  },
  Text: {
    kind: 'field',
    canonicalType: 'Text',
    minCatalogVersion: 1,
    // Arka uç Small Text, Text ve Long Text için `text-area` adını yollar
    // (frappesetup backend: platform_core/shell/catalog.py).
    allowedComponents: ['text', 'textarea', 'text-area'],
  },
  'Small Text': {
    kind: 'field',
    canonicalType: 'Small Text',
    minCatalogVersion: 1,
    allowedComponents: ['small-text', 'text', 'textarea', 'text-area'],
  },
  'Long Text': {
    kind: 'field',
    canonicalType: 'Long Text',
    minCatalogVersion: 1,
    allowedComponents: ['long-text', 'text', 'textarea', 'text-area'],
  },
  'Text Editor': {
    kind: 'field',
    canonicalType: 'Text Editor',
    minCatalogVersion: 2,
    allowedComponents: ['text-editor', 'rich-text', 'editor', 'textarea'],
  },
  Markdown: {
    kind: 'field',
    canonicalType: 'Markdown',
    minCatalogVersion: 2,
    allowedComponents: ['markdown', 'markdown-editor', 'editor', 'textarea'],
  },
  'Markdown Editor': {
    kind: 'field',
    canonicalType: 'Markdown',
    minCatalogVersion: 2,
    allowedComponents: ['markdown', 'markdown-editor', 'editor', 'textarea'],
  },
  Code: {
    kind: 'field',
    canonicalType: 'Code',
    minCatalogVersion: 1,
    allowedComponents: ['code', 'textarea'],
  },
  JSON: {
    kind: 'field',
    canonicalType: 'JSON',
    minCatalogVersion: 1,
    allowedComponents: ['json', 'code', 'textarea'],
  },
  Attach: {
    kind: 'field',
    canonicalType: 'Attach',
    minCatalogVersion: 1,
    allowedComponents: ['attach', 'file', 'upload'],
  },
  'Attach Image': {
    kind: 'field',
    canonicalType: 'Attach Image',
    minCatalogVersion: 1,
    allowedComponents: ['attach-image', 'image', 'image-upload', 'upload'],
  },
  Table: {
    kind: 'field',
    canonicalType: 'Table',
    minCatalogVersion: 1,
    allowedComponents: ['table', 'child-table'],
  },
  'Table MultiSelect': {
    kind: 'field',
    canonicalType: 'Table MultiSelect',
    minCatalogVersion: 2,
    allowedComponents: ['table-multiselect', 'multiselect', 'select'],
  },
  Rating: {
    kind: 'field',
    canonicalType: 'Rating',
    minCatalogVersion: 1,
    allowedComponents: ['rating', 'rate'],
  },
  Signature: {
    kind: 'field',
    canonicalType: 'Signature',
    minCatalogVersion: 2,
    allowedComponents: ['signature'],
  },
  Geolocation: {
    kind: 'field',
    canonicalType: 'Geolocation',
    minCatalogVersion: 2,
    allowedComponents: ['geolocation', 'map', 'location'],
  },
  Color: {
    kind: 'field',
    canonicalType: 'Color',
    minCatalogVersion: 1,
    allowedComponents: ['color', 'color-picker'],
  },
  Barcode: {
    kind: 'field',
    canonicalType: 'Barcode',
    minCatalogVersion: 2,
    allowedComponents: ['barcode', 'input'],
  },
  Password: {
    kind: 'field',
    canonicalType: 'Password',
    minCatalogVersion: 1,
    allowedComponents: ['password', 'input'],
  },
  'Read Only': {
    kind: 'field',
    canonicalType: 'Read Only',
    minCatalogVersion: 1,
    allowedComponents: ['read-only', 'readonly', 'display', 'input'],
  },
  Heading: {
    kind: 'standalone',
    canonicalType: 'Heading',
    minCatalogVersion: 1,
    allowedComponents: ['heading', 'display'],
  },
  HTML: {
    kind: 'standalone',
    canonicalType: 'HTML',
    minCatalogVersion: 1,
    allowedComponents: ['html', 'display'],
  },
  Button: {
    kind: 'standalone',
    canonicalType: 'Button',
    minCatalogVersion: 1,
    allowedComponents: ['button', 'action'],
  },
  'Section Break': {
    kind: 'layout',
    canonicalType: 'Section Break',
    minCatalogVersion: 1,
    allowedComponents: ['section', 'section-break', 'layout'],
  },
  'Column Break': {
    kind: 'layout',
    canonicalType: 'Column Break',
    minCatalogVersion: 1,
    allowedComponents: ['column', 'column-break', 'layout'],
  },
  'Tab Break': {
    kind: 'layout',
    canonicalType: 'Tab Break',
    minCatalogVersion: 1,
    allowedComponents: ['tab', 'tab-break', 'layout'],
  },
};

export function resolveCatalogEntry(
  field: Pick<DocField, 'fieldtype' | 'component'>,
  activeCatalogVersion = CATALOG_VERSION,
): CatalogEntry {
  const def = CATALOG_DEFINITIONS[field.fieldtype];
  if (!def || field.component === null) {
    return {
      supported: false,
      kind: 'unsupported',
      canonicalType: field.fieldtype,
      minCatalogVersion: activeCatalogVersion,
      allowedComponents: [],
    };
  }

  const normalizedComponent = normalizeComponentKey(field.component);
  const isApprovedComponent = def.allowedComponents.includes(normalizedComponent);
  const isVersionActive = def.minCatalogVersion <= activeCatalogVersion;

  if (!isApprovedComponent || !isVersionActive) {
    return {
      supported: false,
      kind: 'unsupported',
      canonicalType: field.fieldtype,
      minCatalogVersion: def.minCatalogVersion,
      allowedComponents: def.allowedComponents,
    };
  }

  return {
    supported: true,
    ...def,
  };
}

export function isLayoutCatalogEntry(entry: CatalogEntry): boolean {
  return entry.supported && entry.kind === 'layout';
}
