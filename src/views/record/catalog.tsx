import { CalendarBlank, Clock, Sparkle, WarningCircle } from '@phosphor-icons/react';
import { Button, Checkbox, Input, InputNumber, Select } from 'antd';
import type { ReactNode } from 'react';

import { CATALOG_VERSION, resolveCatalogEntry } from './catalogRegistry';
import { evaluateFieldState, isFrappeTruthy } from './conditions';
import { ChildTableField, TableMultiSelectField } from './fields/ChildTableField';
import { type FieldControlA11yProps, FieldShell } from './fields/FieldShell';
import { LinkField } from './fields/LinkField';
import { LinkValue } from './fields/LinkValue';
import { RichEditorField, SafeFormattedView } from './fields/RichContentFields';
import {
  AttachField,
  BarcodeField,
  ButtonField,
  ColorField,
  GeolocationField,
  RatingField,
  SignatureField,
} from './fields/SpecializedFields';
import { formatRecordMessage } from './messages';
import type {
  RecordAssistRequest,
  DocField,
  DocTypeMeta,
  RecordDataAdapter,
  RecordLocale,
  SiteFormatting,
} from './types';

function parsePrecision(
  precision: string | null | undefined,
  fallback?: number,
): number | undefined {
  if (!precision) {
    return fallback;
  }
  const parsed = Number.parseInt(precision, 10);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 9 ? parsed : fallback;
}

function toDatetimeLocalInput(frappeValue: unknown): string {
  if (typeof frappeValue !== 'string' || frappeValue.trim().length === 0) {
    return '';
  }
  const withoutMicros = frappeValue.trim().split('.')[0] ?? '';
  return withoutMicros.replace(' ', 'T');
}

function fromDatetimeLocalInput(localValue: string): string {
  const trimmed = localValue.trim();
  if (!trimmed) {
    return '';
  }
  const withSpace = trimmed.replace('T', ' ');
  return withSpace.length === 16 ? `${withSpace}:00` : withSpace;
}

function deriveSelectChoices(field: DocField): { value: string; label: string }[] {
  if (field.choices && field.choices.length > 0) {
    return field.choices.map((c) => ({ value: c.value, label: c.label }));
  }
  if (typeof field.options === 'string' && field.options.length > 0) {
    return field.options
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => ({ value: line, label: line }));
  }
  return [];
}

function formatScalarReadOnly(value: unknown, locale: RecordLocale): string {
  if (value === null || value === undefined || value === '') {
    return formatRecordMessage(locale, 'readOnlyEmpty');
  }
  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }
  if (typeof value === 'number' || typeof value === 'string') {
    return String(value);
  }
  return JSON.stringify(value);
}

export interface CatalogFieldProps {
  field: DocField;
  value: unknown;
  /** Presentation only: the underlying record value stays available to rules and saving. */
  readOnlyDisplayValue?: string | undefined;
  doc: Readonly<Record<string, unknown>>;
  parentDoc?: Readonly<Record<string, unknown>> | undefined;
  doctype: string;
  meta: DocTypeMeta;
  adapter: RecordDataAdapter;
  locale: RecordLocale;
  formatting?: SiteFormatting | undefined;
  catalogVersion?: number | undefined;
  isExistingRecord?: boolean | undefined;
  baseValue?: unknown;
  parentReadOnly?: boolean | undefined;
  isDirty?: boolean | undefined;
  isSubmitting?: boolean | undefined;
  error?: string | undefined;
  sourceNote?: string | undefined;
  compactCell?: boolean | undefined;
  onChange: (fieldname: string, nextValue: unknown) => void;
  onFieldAction?: ((field: DocField) => void) | undefined;
  /** Verilirse uzun metin alanında tek bir "Yardımcıyla yaz" düğmesi görünür. */
  onAssistField?: ((request: RecordAssistRequest) => void) | undefined;
}

/** Yardımcının açıldığı zor alanlar: serbest uzun metin. Kod ve JSON bu kapsamda değildir. */
const ASSISTABLE_TYPES: ReadonlySet<string> = new Set([
  'Small Text',
  'Text',
  'Long Text',
  'Text Editor',
  'Markdown',
]);

export function CatalogField(props: CatalogFieldProps): ReactNode {
  const {
    field,
    value,
    doc,
    parentDoc,
    doctype,
    meta,
    adapter,
    locale,
    formatting,
    catalogVersion = CATALOG_VERSION,
    isExistingRecord,
    baseValue,
    parentReadOnly,
    isDirty,
    isSubmitting = false,
    error,
    sourceNote,
    readOnlyDisplayValue,
    compactCell = false,
    onChange,
    onFieldAction,
    onAssistField,
  } = props;

  const state = evaluateFieldState(field, {
    doc,
    parent: parentDoc,
    isExistingRecord,
    baseValue,
    parentReadOnly,
  });

  if (!state.visible) {
    return null;
  }

  const entry = resolveCatalogEntry(field, Math.min(CATALOG_VERSION, catalogVersion));

  if (entry.kind === 'layout') {
    return null;
  }

  if (!entry.supported) {
    return (
      <FieldShell field={field} locale={locale} hideLabel={compactCell}>
        {() => (
          <div className="rv-unsupported-box" role="note">
            <div className="rv-field-header">
              <WarningCircle weight="regular" />
              <strong>
                {formatRecordMessage(locale, 'unsupportedFieldTitle', {
                  fieldtype: field.fieldtype,
                })}
              </strong>
            </div>
            <span className="rv-field-help">
              {formatRecordMessage(locale, 'unsupportedFieldDescription')}
            </span>
          </div>
        )}
      </FieldShell>
    );
  }

  if (entry.canonicalType === 'Heading') {
    return <h3 className="rv-section-title">{field.label ?? field.fieldname}</h3>;
  }

  if (entry.canonicalType === 'HTML') {
    const htmlSource =
      typeof field.options === 'string' && field.options.length > 0
        ? field.options
        : typeof value === 'string'
          ? value
          : '';
    return <SafeFormattedView content={htmlSource} locale={locale} emptyKey="readOnlyEmpty" />;
  }

  if (entry.canonicalType === 'Button') {
    return (
      <ButtonField
        field={field}
        disabled={state.readOnly || isSubmitting}
        onAction={onFieldAction}
      />
    );
  }

  if (entry.canonicalType === 'Check') {
    const checked = value === true || value === 1 || value === '1';
    return (
      <FieldShell
        field={field}
        locale={locale}
        required={state.required}
        isDirty={isDirty}
        error={error}
        hideLabel
      >
        {(a11y) => (
          <Checkbox
            id={a11y.controlId}
            aria-describedby={a11y.ariaDescribedBy}
            aria-invalid={a11y.ariaInvalid || undefined}
            checked={checked}
            disabled={state.readOnly}
            onChange={(e) => onChange(field.fieldname, e.target.checked ? 1 : 0)}
          >
            {field.label ?? field.fieldname}
          </Checkbox>
        )}
      </FieldShell>
    );
  }

  const renderControl = (a11y: FieldControlA11yProps): ReactNode => {
    if (state.readOnly && readOnlyDisplayValue !== undefined) {
      return (
        <Input
          id={a11y.controlId}
          aria-labelledby={a11y.labelId}
          aria-describedby={a11y.ariaDescribedBy}
          aria-invalid={a11y.ariaInvalid}
          size={compactCell ? 'small' : 'middle'}
          readOnly
          value={readOnlyDisplayValue}
        />
      );
    }
    const strVal =
      typeof value === 'string'
        ? value
        : value === null || value === undefined
          ? ''
          : String(value);

    switch (entry.canonicalType) {
      case 'Read Only':
        return (
          <div
            id={a11y.controlId}
            role="textbox"
            aria-readonly="true"
            aria-describedby={a11y.ariaDescribedBy}
            aria-labelledby={a11y.labelId}
            className="rv-readonly-box"
          >
            {formatScalarReadOnly(value, locale)}
          </div>
        );

      case 'Data':
      case 'Phone': {
        const htmlInputType =
          entry.canonicalType === 'Phone' || field.options === 'Phone'
            ? 'tel'
            : field.options === 'Email'
              ? 'email'
              : field.options === 'URL'
                ? 'url'
                : 'text';
        return (
          <Input
            id={a11y.controlId}
            aria-labelledby={a11y.labelId}
            aria-describedby={a11y.ariaDescribedBy}
            aria-invalid={a11y.ariaInvalid}
            size={compactCell ? 'small' : 'middle'}
            type={htmlInputType}
            readOnly={state.readOnly}
            {...(typeof field.length === 'number' && field.length > 0
              ? { maxLength: field.length }
              : {})}
            value={strVal}
            onChange={(e) => onChange(field.fieldname, e.target.value)}
          />
        );
      }

      case 'Password':
        return (
          <Input.Password
            id={a11y.controlId}
            aria-labelledby={a11y.labelId}
            aria-describedby={a11y.ariaDescribedBy}
            aria-invalid={a11y.ariaInvalid}
            size={compactCell ? 'small' : 'middle'}
            readOnly={state.readOnly}
            autoComplete="new-password"
            value={strVal}
            onChange={(e) => onChange(field.fieldname, e.target.value)}
          />
        );

      case 'Int':
      case 'Duration': {
        const numVal =
          typeof value === 'number'
            ? value
            : value === '' || value === null || value === undefined
              ? null
              : Number(value);
        return (
          <InputNumber<number>
            id={a11y.controlId}
            aria-labelledby={a11y.labelId}
            aria-describedby={a11y.ariaDescribedBy}
            aria-invalid={a11y.ariaInvalid}
            size={compactCell ? 'small' : 'middle'}
            style={{ width: '100%', fontVariantNumeric: 'tabular-nums' }}
            precision={0}
            step={1}
            {...(field.non_negative === true ? { min: 0 } : {})}
            readOnly={state.readOnly}
            value={numVal !== null && Number.isFinite(numVal) ? numVal : null}
            onChange={(next) => onChange(field.fieldname, next)}
          />
        );
      }

      case 'Float':
      case 'Percent': {
        const numVal =
          typeof value === 'number'
            ? value
            : value === '' || value === null || value === undefined
              ? null
              : Number(value);
        const prec = parsePrecision(field.precision);
        return (
          <InputNumber<number>
            id={a11y.controlId}
            aria-labelledby={a11y.labelId}
            aria-describedby={a11y.ariaDescribedBy}
            aria-invalid={a11y.ariaInvalid}
            size={compactCell ? 'small' : 'middle'}
            style={{ width: '100%', fontVariantNumeric: 'tabular-nums' }}
            {...(prec !== undefined ? { precision: prec } : {})}
            {...(field.non_negative === true ? { min: 0 } : {})}
            {...(entry.canonicalType === 'Percent' ? { addonAfter: '%' } : {})}
            readOnly={state.readOnly}
            value={numVal !== null && Number.isFinite(numVal) ? numVal : null}
            onChange={(next) => onChange(field.fieldname, next)}
          />
        );
      }

      case 'Currency': {
        const numVal =
          typeof value === 'number'
            ? value
            : value === '' || value === null || value === undefined
              ? null
              : Number(value);
        const currencyCode =
          formatting?.currency ??
          (field.options && field.options.length <= 5 ? field.options : 'TRY');
        const currencyPrecision = parsePrecision(field.precision, 2) ?? 2;
        return (
          <InputNumber<number>
            id={a11y.controlId}
            aria-labelledby={a11y.labelId}
            aria-describedby={a11y.ariaDescribedBy}
            aria-invalid={a11y.ariaInvalid}
            size={compactCell ? 'small' : 'middle'}
            style={{ width: '100%', fontVariantNumeric: 'tabular-nums' }}
            precision={currencyPrecision}
            {...(field.non_negative === true ? { min: 0 } : {})}
            prefix={currencyCode}
            readOnly={state.readOnly}
            value={numVal !== null && Number.isFinite(numVal) ? numVal : null}
            onChange={(next) => onChange(field.fieldname, next)}
          />
        );
      }

      case 'Select':
      case 'Autocomplete': {
        const choices = deriveSelectChoices(field);
        const selectVal: string | undefined = isFrappeTruthy(strVal) ? strVal : undefined;
        return (
          <Select<string | undefined>
            id={a11y.controlId}
            aria-labelledby={a11y.labelId}
            aria-describedby={a11y.ariaDescribedBy}
            aria-invalid={a11y.ariaInvalid}
            size={compactCell ? 'small' : 'middle'}
            style={{ width: '100%' }}
            showSearch={entry.canonicalType === 'Autocomplete' || choices.length > 6}
            allowClear={!state.required && !state.readOnly}
            disabled={state.readOnly}
            placeholder={formatRecordMessage(locale, 'selectPlaceholder')}
            options={choices}
            value={selectVal}
            onChange={(next) => onChange(field.fieldname, next ?? null)}
          />
        );
      }

      case 'Link':
        if (state.readOnly) {
          return (
            <LinkValue
              targetDoctype={field.options ?? ''}
              value={typeof value === 'string' ? value : null}
              locale={locale}
              a11y={a11y}
            />
          );
        }
        return (
          <LinkField
            field={field}
            targetDoctype={field.options ?? ''}
            referenceDoctype={doctype}
            value={typeof value === 'string' ? value : null}
            readOnly={state.readOnly}
            required={state.required}
            locale={locale}
            adapter={adapter}
            a11y={a11y}
            onChange={(next) => onChange(field.fieldname, next)}
          />
        );

      case 'Dynamic Link': {
        const targetField = field.options;
        const rawTarget =
          typeof targetField === 'string' && targetField.length > 0 ? doc[targetField] : undefined;
        const resolvedDoctype = typeof rawTarget === 'string' ? rawTarget.trim() : '';
        return (
          <LinkField
            field={field}
            targetDoctype={resolvedDoctype}
            referenceDoctype={doctype}
            value={typeof value === 'string' ? value : null}
            readOnly={state.readOnly}
            required={state.required}
            locale={locale}
            adapter={adapter}
            a11y={a11y}
            placeholderOverride={
              resolvedDoctype.length === 0
                ? formatRecordMessage(locale, 'linkSelectTargetFirst')
                : undefined
            }
            onChange={(next) => onChange(field.fieldname, next)}
          />
        );
      }

      case 'Date':
        return (
          <Input
            id={a11y.controlId}
            aria-labelledby={a11y.labelId}
            aria-describedby={a11y.ariaDescribedBy}
            aria-invalid={a11y.ariaInvalid}
            size={compactCell ? 'small' : 'middle'}
            type="date"
            suffix={<CalendarBlank weight="regular" />}
            readOnly={state.readOnly}
            value={strVal}
            onChange={(e) => onChange(field.fieldname, e.target.value)}
          />
        );

      case 'Datetime':
        return (
          <Input
            id={a11y.controlId}
            aria-labelledby={a11y.labelId}
            aria-describedby={a11y.ariaDescribedBy}
            aria-invalid={a11y.ariaInvalid}
            size={compactCell ? 'small' : 'middle'}
            type="datetime-local"
            step={1}
            suffix={<CalendarBlank weight="regular" />}
            readOnly={state.readOnly}
            value={toDatetimeLocalInput(value)}
            onChange={(e) => onChange(field.fieldname, fromDatetimeLocalInput(e.target.value))}
          />
        );

      case 'Time':
        return (
          <Input
            id={a11y.controlId}
            aria-labelledby={a11y.labelId}
            aria-describedby={a11y.ariaDescribedBy}
            aria-invalid={a11y.ariaInvalid}
            size={compactCell ? 'small' : 'middle'}
            type="time"
            step={1}
            suffix={<Clock weight="regular" />}
            readOnly={state.readOnly}
            value={strVal}
            onChange={(e) => onChange(field.fieldname, e.target.value)}
          />
        );

      case 'Small Text':
      case 'Text':
      case 'Long Text':
      case 'Code':
      case 'JSON': {
        const rows =
          entry.canonicalType === 'Small Text' ? 3 : entry.canonicalType === 'Long Text' ? 6 : 4;
        const isCode = entry.canonicalType === 'Code' || entry.canonicalType === 'JSON';
        return (
          <Input.TextArea
            id={a11y.controlId}
            aria-labelledby={a11y.labelId}
            aria-describedby={a11y.ariaDescribedBy}
            aria-invalid={a11y.ariaInvalid}
            rows={rows}
            readOnly={state.readOnly}
            {...(typeof field.length === 'number' && field.length > 0
              ? { maxLength: field.length }
              : {})}
            {...(isCode ? { style: { fontFamily: 'var(--rv-font-mono)' } } : {})}
            value={strVal}
            onChange={(e) => onChange(field.fieldname, e.target.value)}
          />
        );
      }

      case 'Text Editor':
      case 'Markdown':
        return (
          <RichEditorField
            value={strVal}
            readOnly={state.readOnly}
            locale={locale}
            maxLength={field.length}
            a11y={a11y}
            onChange={(next) => onChange(field.fieldname, next)}
          />
        );

      case 'Attach':
      case 'Attach Image':
        return (
          <AttachField
            value={typeof value === 'string' ? value : null}
            isImage={entry.canonicalType === 'Attach Image'}
            readOnly={state.readOnly}
            locale={locale}
            a11y={a11y}
            onChange={(next) => onChange(field.fieldname, next)}
          />
        );

      case 'Table':
        return (
          <ChildTableField
            field={field}
            value={value}
            parentDoc={doc}
            meta={meta}
            readOnly={state.readOnly}
            locale={locale}
            renderCell={(cellParams) => (
              <CatalogField
                field={cellParams.field}
                value={cellParams.value}
                doc={cellParams.row}
                parentDoc={doc}
                doctype={field.options ?? doctype}
                meta={meta}
                adapter={adapter}
                locale={locale}
                formatting={formatting}
                catalogVersion={catalogVersion}
                parentReadOnly={cellParams.readOnly}
                compactCell
                onChange={(_fname, nextCellVal) => cellParams.onCellChange(nextCellVal)}
              />
            )}
            onChange={(nextRows) => onChange(field.fieldname, nextRows)}
          />
        );

      case 'Table MultiSelect':
        return (
          <TableMultiSelectField
            field={field}
            value={value}
            referenceDoctype={doctype}
            meta={meta}
            readOnly={state.readOnly}
            locale={locale}
            adapter={adapter}
            a11y={a11y}
            onChange={(nextRows) => onChange(field.fieldname, nextRows)}
          />
        );

      case 'Rating':
        return (
          <RatingField
            field={field}
            value={value}
            readOnly={state.readOnly}
            a11y={a11y}
            onChange={(next) => onChange(field.fieldname, next)}
          />
        );

      case 'Signature':
        return (
          <SignatureField
            value={typeof value === 'string' ? value : null}
            readOnly={state.readOnly}
            locale={locale}
            a11y={a11y}
            onChange={(next) => onChange(field.fieldname, next)}
          />
        );

      case 'Geolocation':
        return (
          <GeolocationField
            value={value}
            readOnly={state.readOnly}
            locale={locale}
            a11y={a11y}
            onChange={(next) => onChange(field.fieldname, next)}
          />
        );

      case 'Color':
        return (
          <ColorField
            value={strVal}
            readOnly={state.readOnly}
            locale={locale}
            a11y={a11y}
            onChange={(next) => onChange(field.fieldname, next)}
          />
        );

      case 'Barcode':
        return (
          <BarcodeField
            value={strVal}
            readOnly={state.readOnly}
            locale={locale}
            a11y={a11y}
            onChange={(next) => onChange(field.fieldname, next)}
          />
        );

      default:
        return null;
    }
  };

  const canAssist =
    onAssistField !== undefined &&
    !compactCell &&
    !state.readOnly &&
    ASSISTABLE_TYPES.has(entry.canonicalType);
  const assistAction = canAssist
    ? (labelId: string) => (
        <Button
          type="text"
          size="small"
          htmlType="button"
          className="rv-field-assist"
          icon={<Sparkle weight="regular" aria-hidden="true" />}
          aria-describedby={labelId}
          disabled={isSubmitting}
          onClick={() =>
            onAssistField({
              doctype,
              fieldname: field.fieldname,
              label: field.label ?? field.fieldname,
              value: typeof value === 'string' ? value : '',
            })
          }
        >
          {formatRecordMessage(locale, 'assistFieldAction')}
        </Button>
      )
    : undefined;

  return (
    <FieldShell
      field={field}
      locale={locale}
      required={state.required}
      isDirty={isDirty}
      error={error}
      sourceNote={sourceNote}
      hideLabel={compactCell}
      assistAction={assistAction}
    >
      {renderControl}
    </FieldShell>
  );
}
