/**
 * Kayıt ekranı deneme sayfası. Yalnız geliştirme ve tarayıcı testleri içindir.
 *
 * GEÇİCİ: `foundation` işinin `src/design` ve `src/app` sağlayıcısı `main` dalına
 * birleşince ortak tema sağlayıcısını kullanacaktır.
 */
import '@fontsource-variable/outfit';
import '@fontsource/jetbrains-mono/400.css';

import { StrictMode, useState } from 'react';

import { resolveLanguage } from '@/app/locale';
import { sampleBootstrap } from '@/mocks/fixtures';

import { createRoot } from 'react-dom/client';
import { EMPTY_LEAVE_CONTEXT, LEAVE_CONTEXT, LEAVE_META } from './leaveFixture';
import { createFrappeRecordAdapter } from '../adapter';

import {
  type DocTypeMeta,
  RecordApiError,
  type RecordDataAdapter,
  type RecordDocument,
  RecordView,
} from '../index';

/**
 * The test page shows the sample session. Its texts and labels are Turkish, so the page uses the
 * sample user's language, not the fallback language. The fallback language became English (AJA-1413).
 */
const HARNESS_LANGUAGE = resolveLanguage(sampleBootstrap.user.language);

const HARNESS_META: DocTypeMeta = {
  schema: {
    name: 'Expense Claim',
    module: 'HRMS TR',
    sensitivity: 'standard',
    title_field: 'employee_name',
    search_fields: 'employee_name',
    sort_field: 'modified',
    fields: [
      {
        fieldname: 'tab_general',
        fieldtype: 'Tab Break',
        label: 'Genel',
        read_only: false,
        component: 'tab',
        sensitivity: 'standard',
      },
      {
        fieldname: 'sec_summary',
        fieldtype: 'Section Break',
        label: 'Başvuru Özeti',
        collapsible: true,
        read_only: false,
        component: 'section',
        sensitivity: 'standard',
      },
      {
        fieldname: 'employee_name',
        fieldtype: 'Data',
        label: 'Çalışan Adı',
        reqd: true,
        read_only: false,
        component: 'input',
        sensitivity: 'standard',
      },
      {
        fieldname: 'department',
        fieldtype: 'Link',
        label: 'Departman',
        options: 'Department',
        read_only: false,
        component: 'link-select',
        sensitivity: 'standard',
      },
      {
        fieldname: 'status',
        fieldtype: 'Select',
        label: 'Durum',
        read_only: false,
        component: 'select',
        sensitivity: 'standard',
        choices: [
          { value: 'Open', label: 'Açık' },
          { value: 'Approved', label: 'Onaylı' },
        ],
      },
      {
        fieldname: 'col_second',
        fieldtype: 'Column Break',
        read_only: false,
        component: 'column',
        sensitivity: 'standard',
      },
      {
        fieldname: 'posting_date',
        fieldtype: 'Date',
        label: 'Belge Tarihi',
        read_only: false,
        component: 'date',
        sensitivity: 'standard',
      },
      {
        fieldname: 'is_paid',
        fieldtype: 'Check',
        label: 'Ödendi',
        read_only: false,
        component: 'check',
        sensitivity: 'standard',
      },
      {
        fieldname: 'service_rating',
        fieldtype: 'Rating',
        label: 'Hizmet Puanı',
        read_only: false,
        component: 'rating',
        sensitivity: 'standard',
      },
      {
        fieldname: 'tag_color',
        fieldtype: 'Color',
        label: 'Etiket Rengi',
        read_only: false,
        component: 'color',
        sensitivity: 'standard',
      },
      {
        fieldname: 'sec_items',
        fieldtype: 'Section Break',
        label: 'Kalemler ve İmza',
        read_only: false,
        component: 'section',
        sensitivity: 'standard',
      },
      {
        fieldname: 'items',
        fieldtype: 'Table',
        label: 'Harcama Kalemleri',
        options: 'Expense Item',
        read_only: false,
        component: 'table',
        sensitivity: 'standard',
      },
      {
        fieldname: 'notes_editor',
        fieldtype: 'Text Editor',
        label: 'Açıklama Metni',
        read_only: false,
        component: 'text-editor',
        sensitivity: 'standard',
      },
      {
        fieldname: 'attachment',
        fieldtype: 'Attach',
        label: 'Belge Eki',
        read_only: false,
        component: 'attach',
        sensitivity: 'standard',
      },
      {
        fieldname: 'signature',
        fieldtype: 'Signature',
        label: 'Onay İmzası',
        read_only: false,
        component: 'signature',
        sensitivity: 'standard',
      },
      {
        fieldname: 'unknown_legacy',
        fieldtype: 'LegacyPlugin',
        label: 'Eski Eklenti',
        read_only: true,
        component: null,
        sensitivity: 'standard',
      },
    ],
  },
  child_tables: {
    'Expense Item': {
      name: 'Expense Item',
      module: 'HRMS TR',
      sensitivity: 'standard',
      title_field: 'item_title',
      search_fields: 'item_title',
      sort_field: null,
      fields: [
        {
          fieldname: 'item_title',
          fieldtype: 'Data',
          label: 'Kalem Açıklaması',
          in_list_view: true,
          reqd: true,
          read_only: false,
          component: 'input',
          sensitivity: 'standard',
        },
        {
          fieldname: 'expense_date',
          fieldtype: 'Date',
          label: 'Tarih',
          in_list_view: true,
          read_only: false,
          component: 'date',
          sensitivity: 'standard',
        },
        {
          fieldname: 'amount',
          fieldtype: 'Currency',
          label: 'Tutar',
          in_list_view: true,
          read_only: false,
          component: 'currency',
          sensitivity: 'standard',
        },
      ],
    },
  },
  catalog_version: 2,
  meta_hash: 'aaaa',
  perm_version: 'bbbb',
  mobile_cache_allowed: false,
};

const HARNESS_RECORD: RecordDocument = {
  name: 'HR-EXP-0003',
  modified: '2026-11-22 09:00:00.000001',
  docstatus: 0,
  employee_name: 'Örnek Kişi',
  department: 'DEP-ENG',
  status: 'Open',
  posting_date: '2026-11-23',
  is_paid: 0,
  service_rating: 0.8,
  tag_color: '',
  notes_editor: 'Harici toplantı ulaşım gideri.',
  items: [
    {
      name: 'ROW-01',
      item_title: 'Şehir içi ulaşım',
      expense_date: '2026-11-23',
      amount: 450.75,
    },
  ],
};

export function HarnessApp() {
  const params = new URLSearchParams(window.location.search);
  const themeMode = params.get('theme') === 'dark' ? 'dark' : 'light';
  const scenario = params.get('scenario') ?? 'ready';
  const isLeave = scenario === 'leave' || scenario === 'leave-prefill';
  // Exercise the production mapper with a fake shared client. No network request is made.
  const contextAdapter = createFrappeRecordAdapter({
    api: {
      frappeDocument: async (request) => {
        if (
          request.method !== 'GET' ||
          request.path !== '/api/method/hrms_tr.api.get_leave_request_context'
        ) {
          throw new Error('Unexpected harness request');
        }
        const context = params.get('context');
        if (context === 'network') {
          throw new RecordApiError({ code: 'network', message: 'Context request failed' });
        }
        if (context === 'forbidden' || context === 'unauthenticated') {
          throw new RecordApiError({
            code: 'unauthorized',
            status: context === 'forbidden' ? 403 : 401,
            message: 'Context request failed',
          });
        }
        if (context === 'validation') {
          throw new RecordApiError({ code: 'validation', status: 417, message: 'Invalid request' });
        }
        const message =
          context === 'empty'
            ? EMPTY_LEAVE_CONTEXT
            : context === 'zero'
              ? { ...LEAVE_CONTEXT, leave_balance: 0 }
              : context === 'no-allocation'
                ? {
                    ...LEAVE_CONTEXT,
                    leave_type: null,
                    leave_balance: null,
                    sources: { ...LEAVE_CONTEXT.sources, leave_type: null, leave_balance: null },
                  }
                : LEAVE_CONTEXT;
        return { ok: true, status: 200, etag: undefined, body: { message } };
      },
    },
  });
  const [linkFailOnce, setLinkFailOnce] = useState(params.get('linkError') === '1');
  const [currentIndex, setCurrentIndex] = useState(3);
  const [assistCalls, setAssistCalls] = useState(0);

  const adapter: RecordDataAdapter = {
    getDocTypeMeta: async () => (isLeave ? LEAVE_META : HARNESS_META),
    getNewRecordContext:
      scenario === 'leave-prefill' ? contextAdapter.getNewRecordContext : undefined,
    getRecord: async () => {
      if (scenario === 'error') {
        throw new RecordApiError({
          code: 'network',
          message: 'Sunucuya ulaşılamadı.',
        });
      }
      if (scenario === 'unauthorized') {
        throw new RecordApiError({
          code: 'unauthorized',
          status: 403,
          message: 'Bu kaydı görüntüleme yetkiniz bulunmuyor.',
        });
      }
      return HARNESS_RECORD;
    },
    saveRecord: async (saveParams) => ({
      ...HARNESS_RECORD,
      ...saveParams.data,
      modified: '2026-11-22 10:15:00.000001',
    }),
    searchLink: async ({ txt }) => {
      if (linkFailOnce) {
        setLinkFailOnce(false);
        throw new RecordApiError({
          code: 'network',
          message: 'Arama sunucusuna ulaşılamadı.',
        });
      }
      const all = [
        { value: 'DEP-ENG', label: 'Mühendislik', description: 'Yazılım geliştirme' },
        { value: 'DEP-OPS', label: 'Operasyon', description: 'Saha operasyonları' },
      ];
      return txt ? all.filter((item) => item.label.toLowerCase().includes(txt.toLowerCase())) : all;
    },
  };

  return (
    <main data-assist-calls={assistCalls}>
      {isLeave ? (
        <RecordView
          doctype="Leave Application"
          title="Yeni izin talebi"
          saveActionLabel="Talebi gönder"
          createMode
          adapter={adapter}
          themeMode={themeMode}
          locale={HARNESS_LANGUAGE}
          breadcrumbs={[]}
          {...(params.get('assist') === '1'
            ? { onAssistField: () => setAssistCalls((count) => count + 1) }
            : {})}
        />
      ) : (
        <RecordView
          doctype="Expense Claim"
          {...(scenario === 'empty' ? {} : { name: `HR-EXP-000${currentIndex}` })}
          adapter={adapter}
          themeMode={themeMode}
          locale={HARNESS_LANGUAGE}
          navigator={{
            currentIndex,
            totalCount: 1284,
            onNavigate: (next) => setCurrentIndex(next),
          }}
        />
      )}
    </main>
  );
}

const root = document.getElementById('root');
if (!root) {
  throw new Error('Kök öğe bulunamadı: #root');
}

createRoot(root).render(
  <StrictMode>
    <HarnessApp />
  </StrictMode>,
);
