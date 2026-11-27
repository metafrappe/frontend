/**
 * Özelleştirme sayfasının istemcisi (G-97 parça 2). Kod ilk yüke girmez.
 * Modül istemcisi bu dosyayı yalnız `customization()` çağrısında yükler.
 * Yazma istekleri kayıt katmanının bağdaştırıcısından geçer. Bağdaştırıcı ortak API istemcisini kullanır.
 */
import type { ApiClient, RequestOptions } from '@/api';
import { createFrappeRecordAdapter, type RecordDataAdapter } from '@/views/record';

import { CUSTOM_FIELD_DOCTYPE, WORKSPACE_DOCTYPE } from './model';

export interface WorkspaceRow {
  name: string;
  title: string;
  hidden: boolean;
}

export interface CustomizationClient {
  /** Yeni bağdaştırıcı. Tür tanımı önbelleği her değişiklikten sonra boş başlar. */
  createAdapter: () => RecordDataAdapter;
  listDocTypes: (options: RequestOptions) => Promise<string[]>;
  /** Kiracının bu türe eklediği alanların adları. */
  listCustomFieldnames: (doctype: string, options: RequestOptions) => Promise<Set<string>>;
  listWorkspaces: (options: RequestOptions) => Promise<WorkspaceRow[]>;
}

const text = (value: unknown) => (typeof value === 'string' ? value : '');

export function createCustomizationClient(
  api: Pick<ApiClient, 'frappeDocument' | 'listDocuments'>,
): CustomizationClient {
  return {
    createAdapter: () => createFrappeRecordAdapter({ api }),
    listDocTypes: async (options) => {
      const page = await api.listDocuments(
        'DocType',
        { fields: ['name'], filters: { istable: 0, issingle: 0 }, orderBy: 'name asc', limit: 100 },
        options,
      );
      return page.data.map((row) => text(row['name'])).filter(Boolean);
    },
    listCustomFieldnames: async (doctype, options) => {
      const page = await api.listDocuments(
        CUSTOM_FIELD_DOCTYPE,
        { fields: ['fieldname'], filters: { dt: doctype }, limit: 100 },
        options,
      );
      return new Set(page.data.map((row) => text(row['fieldname'])).filter(Boolean));
    },
    listWorkspaces: async (options) => {
      const page = await api.listDocuments(
        WORKSPACE_DOCTYPE,
        {
          fields: ['name', 'title', 'is_hidden'],
          filters: { public: 1 },
          orderBy: 'sequence_id asc',
          limit: 100,
        },
        options,
      );
      return page.data
        .map((row) => ({
          name: text(row['name']),
          title: text(row['title']) || text(row['name']),
          hidden: row['is_hidden'] === 1 || row['is_hidden'] === true,
        }))
        .filter((row) => row.name);
    },
  };
}
