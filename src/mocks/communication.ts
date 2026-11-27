import type { components as ShellComponents } from '@/api/generated/platform_core-shell';

type Meta = ShellComponents['schemas']['Meta'];

/**
 * The mock server's "Communication" schema (AJA-812, G-63).
 * The fields come from Frappe v16 `communication.json`. The list shows only these fields.
 * `communication_medium` options start with an empty option, as in the real schema.
 */
export const sampleCommunicationMeta: Meta = {
  catalog_version: 1,
  child_tables: {},
  meta_hash: 'c'.repeat(64),
  mobile_cache_allowed: false,
  perm_version: 'e'.repeat(64),
  schema: {
    name: 'Communication',
    module: 'Core',
    title_field: 'subject',
    search_fields: '',
    sort_field: 'creation',
    sensitivity: 'standard',
    fields: [
      {
        fieldname: 'subject',
        fieldtype: 'Small Text',
        label: 'Subject',
        component: 'text-area',
        read_only: true,
        sensitivity: 'standard',
      },
      {
        fieldname: 'communication_medium',
        fieldtype: 'Select',
        label: 'Type',
        component: 'select',
        in_list_view: true,
        in_standard_filter: true,
        read_only: true,
        sensitivity: 'standard',
        choices: [
          { value: '', label: '' },
          { value: 'Email', label: 'Email' },
          { value: 'Phone', label: 'Phone' },
        ],
      },
      {
        fieldname: 'reference_name',
        fieldtype: 'Dynamic Link',
        label: 'Reference Name',
        component: 'link-select',
        in_list_view: true,
        read_only: true,
        sensitivity: 'standard',
      },
      {
        fieldname: 'content',
        fieldtype: 'Text Editor',
        label: 'Message',
        component: 'rich-text',
        in_list_view: true,
        read_only: true,
        sensitivity: 'standard',
      },
      {
        fieldname: 'message_id',
        fieldtype: 'Code',
        label: 'Message ID',
        component: 'code-editor',
        in_list_view: true,
        read_only: true,
        sensitivity: 'standard',
      },
    ],
  },
};

/**
 * Mock communication records. The content is long so that line wrapping is tested on narrow
 * screens.
 */
export const sampleCommunications: Record<string, unknown>[] = [
  {
    name: 'ILETISIM-0001',
    subject: 'Teklif hakkında bilgi isteği',
    communication_medium: 'Email',
    reference_name: 'CRM-LEAD-2026-00001',
    content: '<p>Merhaba, <strong>teklifinizi</strong> inceledik &amp; görüşmek istiyoruz.</p>',
    message_id: '<teklif-0001@ornek.test>',
  },
  {
    name: 'ILETISIM-0002',
    subject: 'Telefon görüşmesi notu',
    communication_medium: 'Phone',
    reference_name: 'CRM-DEAL-2026-00002',
    content: '<p>Müşteri yarın yeniden aranacak.</p>',
    message_id: '',
  },
];
