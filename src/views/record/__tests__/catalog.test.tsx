import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CatalogField } from '../catalog';
import { CATALOG_VERSION, isLayoutCatalogEntry, resolveCatalogEntry } from '../catalogRegistry';
import type { DocField, DocTypeMeta, RecordDataAdapter } from '../types';

function createStubAdapter(): RecordDataAdapter {
  return {
    getDocTypeMeta: vi.fn(),
    getRecord: vi.fn(),
    saveRecord: vi.fn(),
    searchLink: vi.fn(async () => [{ value: 'TAG-01', label: 'Öncelikli' }]),
  };
}

const PROMPT_REQUIRED_FIELDTYPES: readonly { fieldtype: string; component: string }[] = [
  { fieldtype: 'Data', component: 'input' },
  { fieldtype: 'Int', component: 'int' },
  { fieldtype: 'Float', component: 'float' },
  { fieldtype: 'Currency', component: 'currency' },
  { fieldtype: 'Check', component: 'check' },
  { fieldtype: 'Select', component: 'select' },
  { fieldtype: 'Link', component: 'link' },
  { fieldtype: 'Dynamic Link', component: 'dynamic-link' },
  { fieldtype: 'Date', component: 'date' },
  { fieldtype: 'Datetime', component: 'datetime' },
  { fieldtype: 'Time', component: 'time' },
  { fieldtype: 'Text', component: 'text' },
  { fieldtype: 'Small Text', component: 'small-text' },
  { fieldtype: 'Text Editor', component: 'text-editor' },
  { fieldtype: 'Markdown', component: 'markdown' },
  { fieldtype: 'Attach', component: 'attach' },
  { fieldtype: 'Attach Image', component: 'attach-image' },
  { fieldtype: 'Table', component: 'table' },
  { fieldtype: 'Table MultiSelect', component: 'table-multiselect' },
  { fieldtype: 'Rating', component: 'rating' },
  { fieldtype: 'Signature', component: 'signature' },
  { fieldtype: 'Geolocation', component: 'geolocation' },
  { fieldtype: 'Color', component: 'color' },
  { fieldtype: 'Barcode', component: 'barcode' },
  { fieldtype: 'Password', component: 'password' },
  { fieldtype: 'Read Only', component: 'read-only' },
  { fieldtype: 'Section Break', component: 'section' },
  { fieldtype: 'Column Break', component: 'column' },
  { fieldtype: 'Tab Break', component: 'tab' },
  { fieldtype: 'HTML', component: 'html' },
  { fieldtype: 'Button', component: 'button' },
];

const CHILD_META: DocTypeMeta = {
  schema: {
    name: 'Expense Claim',
    module: 'HRMS TR',
    sensitivity: 'standard',
    fields: [],
    title_field: null,
    search_fields: '',
    sort_field: null,
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
          label: 'Kalem',
          in_list_view: true,
          reqd: true,
          read_only: false,
          component: 'input',
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
    'Expense Tag Link': {
      name: 'Expense Tag Link',
      module: 'HRMS TR',
      sensitivity: 'standard',
      title_field: null,
      search_fields: '',
      sort_field: null,
      fields: [
        {
          fieldname: 'tag',
          fieldtype: 'Link',
          label: 'Etiket',
          options: 'Tag',
          read_only: false,
          component: 'link',
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

describe('versioned field catalog (RE-11, AX-4, Goal 1)', () => {
  it('registers all 31 required Frappe field types in versioned catalog', () => {
    expect(CATALOG_VERSION).toBeGreaterThanOrEqual(2);

    for (const spec of PROMPT_REQUIRED_FIELDTYPES) {
      const field: DocField = {
        fieldname: `fld_${spec.fieldtype.toLowerCase().replace(/\s+/g, '_')}`,
        fieldtype: spec.fieldtype,
        read_only: false,
        component: spec.component,
        sensitivity: 'standard',
      };
      const entry = resolveCatalogEntry(field, CATALOG_VERSION);
      expect(entry.supported, `Expected ${spec.fieldtype} to be supported`).toBe(true);
      if (
        spec.fieldtype === 'Section Break' ||
        spec.fieldtype === 'Column Break' ||
        spec.fieldtype === 'Tab Break'
      ) {
        expect(isLayoutCatalogEntry(entry)).toBe(true);
      }
    }
  });

  it('falls back safely to unsupported field view for unknown fieldtype, null component, or unapproved component', () => {
    const adapter = createStubAdapter();
    const unknownTypeField: DocField = {
      fieldname: 'quantum_state',
      fieldtype: 'QuantumState',
      label: 'Kuantum Alanı',
      read_only: false,
      component: 'quantum',
      sensitivity: 'standard',
    };

    const { rerender } = render(
      <CatalogField
        field={unknownTypeField}
        value="raw-val"
        doc={{ quantum_state: 'raw-val' }}
        doctype="Sample"
        meta={CHILD_META}
        adapter={adapter}
        locale="tr"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Desteklenmeyen alan (QuantumState)')).toBeInTheDocument();

    const nullComponentField: DocField = {
      fieldname: 'server_blocked',
      fieldtype: 'Data',
      label: 'Sunucu Kapalı Alan',
      read_only: false,
      component: null,
      sensitivity: 'standard',
    };
    rerender(
      <CatalogField
        field={nullComponentField}
        value="secret"
        doc={{ server_blocked: 'secret' }}
        doctype="Sample"
        meta={CHILD_META}
        adapter={adapter}
        locale="tr"
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Desteklenmeyen alan (Data)')).toBeInTheDocument();
  });

  it('renders and updates scalar, choice, rich text, geolocation, barcode, color, rating, and button fields cleanly', async () => {
    const user = userEvent.setup();
    const adapter = createStubAdapter();
    const onChange = vi.fn();
    const onFieldAction = vi.fn();

    const selectField: DocField = {
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
    };

    const htmlField: DocField = {
      fieldname: 'policy_notice',
      fieldtype: 'HTML',
      label: 'Politika Notu',
      options: '<p>Güvenli metin</p><script>window.__hacked = true;</script>',
      read_only: true,
      component: 'html',
      sensitivity: 'standard',
    };

    const buttonField: DocField = {
      fieldname: 'calculate_btn',
      fieldtype: 'Button',
      label: 'Sunucuda Hesapla',
      read_only: false,
      component: 'button',
      sensitivity: 'standard',
    };

    const geoField: DocField = {
      fieldname: 'office_location',
      fieldtype: 'Geolocation',
      label: 'Ofis Konumu',
      read_only: false,
      component: 'geolocation',
      sensitivity: 'standard',
    };

    const colorField: DocField = {
      fieldname: 'brand_color',
      fieldtype: 'Color',
      label: 'Marka Rengi',
      read_only: false,
      component: 'color',
      sensitivity: 'standard',
    };

    const ratingField: DocField = {
      fieldname: 'service_rating',
      fieldtype: 'Rating',
      label: 'Hizmet Puanı',
      read_only: false,
      component: 'rating',
      sensitivity: 'standard',
    };

    // Mock denied geolocation to verify Review 2 Minor 2 error handling
    const originalGeo = navigator.geolocation;
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (_ok: PositionCallback, err?: PositionErrorCallback) => {
          err?.({
            code: 1,
            message: 'Denied',
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          });
        },
      },
    });

    try {
      const { container } = render(
        <div>
          <CatalogField
            field={selectField}
            value="Open"
            doc={{ status: 'Open' }}
            doctype="Expense Claim"
            meta={CHILD_META}
            adapter={adapter}
            locale="tr"
            onChange={onChange}
          />
          <CatalogField
            field={htmlField}
            value={null}
            doc={{}}
            doctype="Expense Claim"
            meta={CHILD_META}
            adapter={adapter}
            locale="tr"
            onChange={onChange}
          />
          <CatalogField
            field={buttonField}
            value={null}
            doc={{}}
            doctype="Expense Claim"
            meta={CHILD_META}
            adapter={adapter}
            locale="tr"
            onChange={onChange}
            onFieldAction={onFieldAction}
          />
          <CatalogField
            field={geoField}
            value={null}
            doc={{}}
            doctype="Expense Claim"
            meta={CHILD_META}
            adapter={adapter}
            locale="tr"
            onChange={onChange}
          />
          <CatalogField
            field={colorField}
            value=""
            doc={{ brand_color: '' }}
            doctype="Expense Claim"
            meta={CHILD_META}
            adapter={adapter}
            locale="tr"
            onChange={onChange}
          />
          <CatalogField
            field={ratingField}
            value={0.6}
            doc={{ service_rating: 0.6 }}
            doctype="Expense Claim"
            meta={CHILD_META}
            adapter={adapter}
            locale="tr"
            onChange={onChange}
          />
        </div>,
      );

      expect(container.querySelector('select')).toBeNull();
      expect(screen.getByText('Güvenli metin')).toBeInTheDocument();
      expect(container.querySelector('script')).toBeNull();

      await user.click(screen.getByRole('button', { name: 'Sunucuda Hesapla' }));
      expect(onFieldAction).toHaveBeenCalledWith(buttonField);

      // Review 2 Finding 6: empty Color field must stay empty (not display #00aacc as value)
      const colorInput = screen.getByLabelText('Marka Rengi');
      expect(colorInput).toHaveValue('');

      // Review 2 Minor 3: Rating label is bound directly to the Rate list control (not a wrapper div)
      const rateControl = screen.getByRole('list', { name: 'Hizmet Puanı' });
      expect(rateControl).toHaveClass('ant-rate');
      expect(screen.getByLabelText('Hizmet Puanı')).toBe(rateControl);

      // Review 2 Minor 2: Geolocation permission denial shows error text
      await user.click(screen.getByRole('button', { name: 'Cihaz konumunu al' }));
      expect(screen.getByText(/Konum bilgisi alınamadı/)).toBeInTheDocument();
    } finally {
      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: originalGeo,
      });
    }
  });

  it('preserves multiple strokes in Signature field and provides a keyboard signing option (Review 2 Findings 2, 3 & Minor 4)', async () => {
    const user = userEvent.setup();
    const adapter = createStubAdapter();
    const onChange = vi.fn();

    const sigField: DocField = {
      fieldname: 'employee_signature',
      fieldtype: 'Signature',
      label: 'Çalışan İmzası',
      read_only: false,
      component: 'signature',
      sensitivity: 'standard',
    };

    render(
      <CatalogField
        field={sigField}
        value={null}
        doc={{}}
        doctype="Expense Claim"
        meta={CHILD_META}
        adapter={adapter}
        locale="tr"
        onChange={onChange}
      />,
    );

    const canvas = screen.getByRole('img', { name: 'Çalışan İmzası' });

    // Stroke 1
    fireEvent.pointerDown(canvas, { clientX: 20, clientY: 30 });
    fireEvent.pointerMove(canvas, { clientX: 80, clientY: 40 });
    fireEvent.pointerUp(canvas);

    // Stroke 2
    fireEvent.pointerDown(canvas, { clientX: 120, clientY: 60 });
    fireEvent.pointerMove(canvas, { clientX: 200, clientY: 70 });
    fireEvent.pointerUp(canvas);

    expect(onChange).toHaveBeenCalledTimes(2);
    const secondSavedDataUrl = String(onChange.mock.calls[1]?.[1] ?? '');
    const decoded = decodeURIComponent(secondSavedDataUrl);
    // Both M20 30 and M120 60 strokes must remain in the serialized multi-stroke output
    expect(decoded).toContain('M20 30');
    expect(decoded).toContain('M120 60');

    // Keyboard signing option (RE-10 / Review 2 Minor 4 & Review 3 Minor 1, 2, 3)
    const fillTextCalls: { text: string; x: number; y: number; font: string }[] = [];
    const fakeCtx = {
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      scale: vi.fn(),
      fillText: vi.fn((text: string, x: number, y: number) => {
        fillTextCalls.push({ text, x, y, font: fakeCtx.font });
      }),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 2,
      lineCap: 'round',
      lineJoin: 'round',
      font: '',
      textBaseline: 'middle',
    };

    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockImplementation(() => fakeCtx as unknown as CanvasRenderingContext2D);
    const toDataUrlSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'toDataURL')
      .mockReturnValue('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ');

    try {
      await user.click(screen.getByText('Yazarak imzala'));
      const nameSignInput = screen.getByLabelText('İmza metni');
      await user.type(nameSignInput, 'Örnek İmza');
      await user.click(screen.getByRole('button', { name: 'İmzayı uygula' }));

      const typedCall = String(onChange.mock.calls[onChange.mock.calls.length - 1]?.[1] ?? '');
      // Review 3 Minor 1: Typed signature must produce PNG via an offscreen canvas even when draw canvas is unmounted
      expect(typedCall.startsWith('data:image/png;base64,')).toBe(true);
      expect(fillTextCalls).toHaveLength(1);
    } finally {
      getContextSpy.mockRestore();
      toDataUrlSpy.mockRestore();
    }

    // Review 3 Minor 3: Switching back to Draw mode must have cleared old strokes (M20 30 / M120 60)
    await user.click(screen.getByText('Çiz'));
    const remountedCanvas = screen.getByRole('img', { name: 'Çalışan İmzası' });
    fireEvent.pointerDown(remountedCanvas, { clientX: 55, clientY: 65 });
    fireEvent.pointerMove(remountedCanvas, { clientX: 95, clientY: 75 });
    fireEvent.pointerUp(remountedCanvas);

    const postSwitchSvg = decodeURIComponent(
      String(onChange.mock.calls[onChange.mock.calls.length - 1]?.[1] ?? ''),
    );
    expect(postSwitchSvg).toContain('M55 65');
    expect(postSwitchSvg).not.toContain('M20 30');
    expect(postSwitchSvg).not.toContain('M120 60');
  });

  it('emits null (not empty string) when clearing optional Select, Link, or Dynamic Link fields (Review 3 Minor 7)', async () => {
    const user = userEvent.setup();
    const adapter = createStubAdapter();
    const onChange = vi.fn();

    const selectField: DocField = {
      fieldname: 'status',
      fieldtype: 'Select',
      label: 'Durum Seçimi',
      read_only: false,
      component: 'select',
      sensitivity: 'standard',
      choices: [{ value: 'Open', label: 'Açık' }],
    };

    const linkField: DocField = {
      fieldname: 'department',
      fieldtype: 'Link',
      label: 'Departman Seçimi',
      options: 'Department',
      read_only: false,
      component: 'link',
      sensitivity: 'standard',
    };

    const dynamicLinkField: DocField = {
      fieldname: 'ref_doc',
      fieldtype: 'Dynamic Link',
      label: 'Dinamik Bağlantı',
      options: 'ref_type',
      read_only: false,
      component: 'dynamic-link',
      sensitivity: 'standard',
    };

    const { container } = render(
      <div>
        <CatalogField
          field={selectField}
          value="Open"
          doc={{ status: 'Open', ref_type: 'Project' }}
          doctype="Expense Claim"
          meta={CHILD_META}
          adapter={adapter}
          locale="tr"
          onChange={onChange}
        />
        <CatalogField
          field={linkField}
          value="DEP-01"
          doc={{ department: 'DEP-01', ref_type: 'Project' }}
          doctype="Expense Claim"
          meta={CHILD_META}
          adapter={adapter}
          locale="tr"
          onChange={onChange}
        />
        <CatalogField
          field={dynamicLinkField}
          value="PRJ-01"
          doc={{ ref_doc: 'PRJ-01', ref_type: 'Project' }}
          doctype="Expense Claim"
          meta={CHILD_META}
          adapter={adapter}
          locale="tr"
          onChange={onChange}
        />
      </div>,
    );

    const clearIcons = container.querySelectorAll('.ant-select-clear');
    expect(clearIcons).toHaveLength(3);
    for (const clearBtn of clearIcons) {
      await user.click(clearBtn);
    }

    expect(onChange).toHaveBeenCalledWith('status', null);
    expect(onChange).toHaveBeenCalledWith('department', null);
    expect(onChange).toHaveBeenCalledWith('ref_doc', null);
  });

  it('renders child Table with meta.child_tables and supports adding and removing rows', async () => {
    const user = userEvent.setup();
    const adapter = createStubAdapter();
    const onChange = vi.fn();

    const tableField: DocField = {
      fieldname: 'items',
      fieldtype: 'Table',
      label: 'Harcama Kalemleri',
      options: 'Expense Item',
      read_only: false,
      component: 'table',
      sensitivity: 'standard',
    };

    render(
      <CatalogField
        field={tableField}
        value={[{ name: 'ROW-1', item_title: 'Ulaşım', amount: 250 }]}
        doc={{ items: [{ name: 'ROW-1', item_title: 'Ulaşım', amount: 250 }] }}
        doctype="Expense Claim"
        meta={CHILD_META}
        adapter={adapter}
        locale="tr"
        onChange={onChange}
      />,
    );

    expect(screen.getByDisplayValue('Ulaşım')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Satır ekle' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    const addedRows = onChange.mock.calls[0]?.[1] as unknown[];
    expect(addedRows).toHaveLength(2);
  });

  describe('aramalı seçim kutusu kullanıcının dilini kullanır (GILT 10)', () => {
    const cities = ['Ankara', 'Bursa', 'İzmir', 'Isparta', 'Konya', 'Muğla', 'Ordu'];
    const cityField: DocField = {
      fieldname: 'city',
      fieldtype: 'Select',
      label: 'Şehir',
      read_only: false,
      component: 'select',
      sensitivity: 'standard',
      choices: cities.map((city) => ({ value: city, label: city })),
    };

    async function search(locale: 'tr' | 'en', query: string): Promise<string[]> {
      const user = userEvent.setup();
      render(
        <CatalogField
          field={cityField}
          value={null}
          doc={{}}
          doctype="Expense Claim"
          meta={CHILD_META}
          adapter={createStubAdapter()}
          locale={locale}
          onChange={vi.fn()}
        />,
      );
      await user.type(screen.getByRole('combobox'), query);
      return screen.queryAllByRole('option').map((option) => option.textContent ?? '');
    }

    it('Türkçede izmir araması İzmir seçeneğini bulur', async () => {
      expect(await search('tr', 'izmir')).toEqual(['İzmir']);
    });

    it('Türkçede ısparta araması Isparta seçeneğini bulur', async () => {
      expect(await search('tr', 'ısparta')).toEqual(['Isparta']);
    });

    it('İngiliz İngilizcesinde isparta araması Isparta seçeneğini bulur', async () => {
      expect(await search('en', 'isparta')).toEqual(['Isparta']);
    });
  });
});
