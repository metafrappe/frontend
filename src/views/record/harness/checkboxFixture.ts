import type { DocTypeMeta } from '../types';

/** Synthetic required checkbox followed by a required text field. No live adapter. */
export const CHECKBOX_META: DocTypeMeta = {
  schema: {
    name: 'Checkbox Example',
    module: 'Example',
    sensitivity: 'standard',
    fields: [
      {
        fieldname: 'confirmed',
        fieldtype: 'Check',
        label: 'Bilgileri kontrol ettim',
        component: 'checkbox',
        read_only: false,
        sensitivity: 'standard',
        reqd: true,
        description: 'Göndermeden önce bilgileri kontrol edin.',
      },
      {
        fieldname: 'title',
        fieldtype: 'Data',
        label: 'Başlık',
        component: 'input',
        read_only: false,
        sensitivity: 'standard',
        reqd: true,
      },
    ],
  },
  child_tables: {},
  catalog_version: 2,
  meta_hash: 'checkbox-fixture',
  perm_version: 'checkbox-fixture',
  mobile_cache_allowed: false,
};
