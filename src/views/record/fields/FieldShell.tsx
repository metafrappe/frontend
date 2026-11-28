import { type ReactNode, useId } from 'react';

import { HelpMarker } from '@/shell/help';

import { formatRecordMessage } from '../messages';
import type { DocField, RecordLocale } from '../types';

export interface FieldControlA11yProps {
  controlId: string;
  labelId: string;
  ariaDescribedBy: string | undefined;
  ariaInvalid: boolean;
}

export interface FieldShellProps {
  field: DocField;
  locale: RecordLocale;
  required?: boolean | undefined;
  isDirty?: boolean | undefined;
  error?: string | undefined;
  sourceNote?: string | undefined;
  hideLabel?: boolean | undefined;
  children: (a11y: FieldControlA11yProps) => ReactNode;
  /** Uzun metin alanının yardımcı düğmesi. Etiket kimliğini alır; düğme alan adıyla tanımlanır. */
  assistAction?: ((labelId: string) => ReactNode) | undefined;
}

export function FieldShell(props: FieldShellProps) {
  const {
    field,
    locale,
    required = false,
    isDirty = false,
    error,
    sourceNote,
    hideLabel = false,
    children,
    assistAction,
  } = props;
  const reactId = useId();
  const controlId = `rv-fld-${field.fieldname}-${reactId}`;
  const labelId = `${controlId}-label`;
  const helpId = `${controlId}-help`;
  const errorId = `${controlId}-err`;
  const sourceId = `${controlId}-source`;

  const describedIds: string[] = [];
  if (field.description) {
    describedIds.push(helpId);
  }
  if (error) {
    describedIds.push(errorId);
  }
  if (sourceNote) describedIds.push(sourceId);
  const ariaDescribedBy = describedIds.length > 0 ? describedIds.join(' ') : undefined;
  const displayLabel = field.label ?? field.fieldname;

  return (
    <div
      className={`rv-field${isDirty ? ' rv-field--dirty' : ''}`}
      data-fieldname={field.fieldname}
      data-fieldtype={field.fieldtype}
    >
      {!hideLabel ? (
        <div className="rv-field-header">
          <label htmlFor={controlId} id={labelId} className="rv-field-label">
            {displayLabel}
            {required ? (
              <span className="rv-field-reqd" aria-hidden="true">
                *
              </span>
            ) : null}
          </label>
          <HelpMarker
            target={{
              kind: 'field',
              label: displayLabel,
              fieldname: field.fieldname,
              description: field.description,
            }}
          />
          {field.sensitivity === 'restricted' ? (
            <span className="rv-pill rv-pill--warning">
              {formatRecordMessage(locale, 'restrictedBadge')}
            </span>
          ) : null}
        </div>
      ) : (
        <span id={labelId} hidden>
          {displayLabel}
        </span>
      )}

      {children({
        controlId,
        labelId,
        ariaDescribedBy,
        ariaInvalid: Boolean(error),
      })}

      {error ? (
        <p id={errorId} className="rv-field-error">
          {error}
        </p>
      ) : null}
      {assistAction ? (
        <div className="rv-field-footer">
          {field.description ? (
            <p id={helpId} className="rv-field-help">
              {field.description}
            </p>
          ) : null}
          {assistAction(labelId)}
        </div>
      ) : field.description ? (
        <p id={helpId} className="rv-field-help">
          {field.description}
        </p>
      ) : null}
      {sourceNote ? (
        <p id={sourceId} className="rv-field-help rv-field-source">
          {sourceNote}
        </p>
      ) : null}
    </div>
  );
}
