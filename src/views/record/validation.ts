import { isUnresolvedNumber } from '@/app/locale';

import { evaluateFieldState, isFrappeTruthy } from './conditions';
import { isLayoutBreakFieldType } from './layout';
import { formatRecordMessage } from './messages';
import type { DocField, DocTypeMeta, RecordLocale } from './types';

const NON_DATA_FIELDTYPES = new Set([
  'Section Break',
  'Column Break',
  'Tab Break',
  'HTML',
  'Heading',
  'Button',
  'Read Only',
]);

function normalizeCheckValue(value: unknown): boolean {
  return value === true || value === 1 || value === '1';
}

function areValuesEqualForField(field: DocField, left: unknown, right: unknown): boolean {
  if (field.fieldtype === 'Check') {
    return normalizeCheckValue(left) === normalizeCheckValue(right);
  }
  if (field.fieldtype === 'Table' || field.fieldtype === 'Table MultiSelect') {
    const leftArr = Array.isArray(left) ? left : [];
    const rightArr = Array.isArray(right) ? right : [];
    if (leftArr.length !== rightArr.length) {
      return false;
    }
    return JSON.stringify(leftArr) === JSON.stringify(rightArr);
  }
  if ((left === undefined || left === null) && (right === undefined || right === null)) {
    return true;
  }
  return Object.is(left, right);
}

export function computeDirtyFields(
  fields: readonly DocField[],
  baseRecord: Readonly<Record<string, unknown>>,
  draftValues: Readonly<Record<string, unknown>>,
): string[] {
  const dirty: string[] = [];
  const isExistingRecord =
    typeof baseRecord['name'] === 'string' && baseRecord['name'].trim().length > 0;

  for (const field of fields) {
    if (NON_DATA_FIELDTYPES.has(field.fieldtype)) {
      continue;
    }
    // Review 1 Minor 4: Check evaluated readOnly (including read_only_depends_on & unsupported_conditions).
    const evaluated = evaluateFieldState(field, {
      doc: draftValues,
      isExistingRecord,
      baseValue: baseRecord[field.fieldname],
    });
    if (evaluated.readOnly) {
      continue;
    }
    const baseVal = baseRecord[field.fieldname];
    const draftVal = draftValues[field.fieldname];
    if (!areValuesEqualForField(field, baseVal, draftVal)) {
      dirty.push(field.fieldname);
    }
  }
  return dirty;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidUrlValue(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function parseNumericDraftValue(rawValue: unknown): number {
  if (typeof rawValue === 'number') {
    return rawValue;
  }
  if (typeof rawValue === 'string') {
    const trimmed = rawValue.trim();
    // Review 1 Minor 2: Whitespace-only strings must NOT coerce to 0 via Number(' ').
    if (trimmed.length === 0) {
      return Number.NaN;
    }
    return Number(trimmed);
  }
  return Number.NaN;
}

export interface ValidateDraftOptions {
  isExistingRecord?: boolean | undefined;
  baseRecord?: Readonly<Record<string, unknown>> | undefined;
}

export function validateRecordDraft(
  meta: DocTypeMeta,
  draftValues: Readonly<Record<string, unknown>>,
  locale: RecordLocale,
  options?: ValidateDraftOptions,
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const field of meta.schema.fields) {
    if (isLayoutBreakFieldType(field.fieldtype) || NON_DATA_FIELDTYPES.has(field.fieldtype)) {
      continue;
    }

    const state = evaluateFieldState(field, {
      doc: draftValues,
      isExistingRecord: options?.isExistingRecord,
      baseValue: options?.baseRecord?.[field.fieldname],
    });

    if (!state.visible || state.readOnly) {
      continue;
    }

    const label = field.label ?? field.fieldname;
    const rawValue = draftValues[field.fieldname];

    if (state.required && !isFrappeTruthy(rawValue)) {
      errors[field.fieldname] = formatRecordMessage(locale, 'validationRequired', { label });
      continue;
    }

    if (rawValue === undefined || rawValue === null || rawValue === '') {
      continue;
    }

    if (field.fieldtype === 'Int') {
      const num = parseNumericDraftValue(rawValue);
      if (!Number.isInteger(num)) {
        errors[field.fieldname] = formatRecordMessage(locale, 'validationInteger', { label });
        continue;
      }
      if (field.non_negative === true && num < 0) {
        errors[field.fieldname] = formatRecordMessage(locale, 'validationNonNegative', { label });
        continue;
      }
    }

    if (
      field.fieldtype === 'Float' ||
      field.fieldtype === 'Currency' ||
      field.fieldtype === 'Percent'
    ) {
      // Unclear or broken typed text is never saved silently (AJA-1765).
      if (isUnresolvedNumber(rawValue)) {
        errors[field.fieldname] = formatRecordMessage(
          locale,
          rawValue.reason === 'ambiguous' ? 'validationNumberAmbiguous' : 'validationNumber',
          { label },
        );
        continue;
      }
      const num = parseNumericDraftValue(rawValue);
      if (!Number.isFinite(num)) {
        errors[field.fieldname] = formatRecordMessage(locale, 'validationNumber', { label });
        continue;
      }
      if (field.non_negative === true && num < 0) {
        errors[field.fieldname] = formatRecordMessage(locale, 'validationNonNegative', { label });
        continue;
      }
    }

    if (typeof rawValue === 'string') {
      if (typeof field.length === 'number' && field.length > 0 && rawValue.length > field.length) {
        errors[field.fieldname] = formatRecordMessage(locale, 'validationMaxLength', {
          label,
          max: field.length,
        });
        continue;
      }
      if (
        field.fieldtype === 'Data' &&
        field.options === 'Email' &&
        !EMAIL_PATTERN.test(rawValue)
      ) {
        errors[field.fieldname] = formatRecordMessage(locale, 'validationEmail', { label });
        continue;
      }
      if (field.fieldtype === 'Data' && field.options === 'URL' && !isValidUrlValue(rawValue)) {
        errors[field.fieldname] = formatRecordMessage(locale, 'validationUrl', { label });
        continue;
      }
    }

    if (field.fieldtype === 'Table' && field.options && Array.isArray(rawValue)) {
      const childSchema = meta.child_tables[field.options];
      if (childSchema) {
        for (let rowIndex = 0; rowIndex < rawValue.length; rowIndex += 1) {
          const rowItem: unknown = rawValue[rowIndex];
          const rowRecord =
            typeof rowItem === 'object' && rowItem !== null
              ? (rowItem as Record<string, unknown>)
              : {};
          for (const childField of childSchema.fields) {
            if (
              isLayoutBreakFieldType(childField.fieldtype) ||
              NON_DATA_FIELDTYPES.has(childField.fieldtype)
            ) {
              continue;
            }
            const childState = evaluateFieldState(childField, {
              doc: rowRecord,
              parent: draftValues,
            });
            if (childState.visible && !childState.readOnly && childState.required) {
              if (!isFrappeTruthy(rowRecord[childField.fieldname])) {
                errors[field.fieldname] = formatRecordMessage(
                  locale,
                  'validationChildRowRequired',
                  {
                    row: rowIndex + 1,
                    label: childField.label ?? childField.fieldname,
                  },
                );
                break;
              }
            }
          }
          if (errors[field.fieldname]) {
            break;
          }
        }
      }
    }
  }

  return errors;
}
