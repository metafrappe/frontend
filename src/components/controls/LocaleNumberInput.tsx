import type { InputProps } from 'antd';
import { useEffect, useId, useRef, useState } from 'react';

import {
  formatNumberInput,
  isUnresolvedNumber,
  parseLocaleNumber,
  UnresolvedNumber,
} from '@/app/locale';

import { Input } from './FormControls';
import { Button } from './SurfaceControls';

/** Texts of the field. They come from the caller's catalog (IC-10). */
export interface LocaleNumberMessages {
  /** Question for an unclear value. Example: "Which number did you mean?". */
  ambiguous: string;
  /** Message for a value that is not a number. It should show an example in the region format. */
  invalid: string;
}

/** The value of the field. A number, an empty value or text that is not a number yet. */
export type LocaleNumberValue = number | null | UnresolvedNumber;

export interface LocaleNumberInputProps extends Omit<
  InputProps,
  'value' | 'defaultValue' | 'onChange' | 'type' | 'inputMode'
> {
  value: unknown;
  /**
   * Gets a number, `null` for an empty field, or `UnresolvedNumber`.
   * `UnresolvedNumber` is unclear or broken text. A form must not save it.
   */
  onChange: (next: LocaleNumberValue) => void;
  /** `Intl` locale of the user's region. Example: `fr-FR`. */
  locale: string;
  /** Number of decimals. Example: 2 for an amount. */
  precision?: number | undefined;
  messages: LocaleNumberMessages;
}

function round(value: number, precision: number | undefined): number {
  return precision === undefined ? value : Number(value.toFixed(precision));
}

function textFor(value: unknown, locale: string, precision: number | undefined): string {
  if (isUnresolvedNumber(value)) return value.text;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return formatNumberInput(value, locale, precision);
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const number = Number(value);
    return Number.isFinite(number) ? formatNumberInput(number, locale, precision) : value;
  }
  return '';
}

/**
 * Number field in the format of the user's region (AJA-1765).
 * Example: a French user types `1 234,56`, a German user types `1.234,56`. Both give 1234.56.
 * An unclear value such as `1.234` is not saved. The field asks which number the user meant.
 */
export function LocaleNumberInput({
  value,
  onChange,
  locale,
  precision,
  messages,
  onBlur,
  readOnly,
  disabled,
  'aria-describedby': describedBy,
  'aria-invalid': ariaInvalid,
  ...props
}: LocaleNumberInputProps) {
  const [text, setText] = useState(() => textFor(value, locale, precision));
  const [touched, setTouched] = useState(false);
  // The last value the field sent. A new value from outside replaces the text. Example: a reopened record.
  const sent = useRef<unknown>(value);
  const shown = useRef({ locale, precision });
  const messageId = useId();

  useEffect(() => {
    const formatChanged = shown.current.locale !== locale || shown.current.precision !== precision;
    shown.current = { locale, precision };
    if (Object.is(value, sent.current) && !formatChanged) return;
    sent.current = value;
    setText(textFor(value, locale, precision));
    setTouched(false);
  }, [value, locale, precision]);

  const entry = parseLocaleNumber(text, locale);

  function send(next: LocaleNumberValue) {
    sent.current = next;
    onChange(next);
  }

  function handleChange(nextText: string) {
    setText(nextText);
    const next = parseLocaleNumber(nextText, locale);
    if (next.kind === 'empty') send(null);
    else if (next.kind === 'valid') send(round(next.value, precision));
    else send(new UnresolvedNumber(nextText, next.kind));
  }

  function choose(option: number) {
    const next = round(option, precision);
    setText(formatNumberInput(next, locale, precision));
    setTouched(false);
    send(next);
  }

  const showProblem = touched && (entry.kind === 'ambiguous' || entry.kind === 'invalid');
  const describedByIds = [describedBy, showProblem ? messageId : undefined]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="atonota-number-entry">
      <Input
        {...props}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        {...(readOnly !== undefined ? { readOnly } : {})}
        {...(disabled !== undefined ? { disabled } : {})}
        value={text}
        aria-invalid={ariaInvalid === true || ariaInvalid === 'true' || showProblem || undefined}
        aria-describedby={describedByIds || undefined}
        onChange={(event) => handleChange(event.target.value)}
        onBlur={(event) => {
          setTouched(true);
          if (entry.kind === 'valid') {
            setText(formatNumberInput(round(entry.value, precision), locale, precision));
          }
          onBlur?.(event);
        }}
      />
      {showProblem && entry.kind === 'ambiguous' ? (
        <div
          role="group"
          id={messageId}
          aria-labelledby={`${messageId}-q`}
          className="atonota-number-question"
        >
          <p id={`${messageId}-q`} className="atonota-number-message">
            {messages.ambiguous}
          </p>
          <div className="atonota-number-options">
            {entry.options.map((option) => (
              <Button
                key={option}
                size="middle"
                disabled={readOnly === true || disabled === true}
                onClick={() => choose(option)}
              >
                {formatNumberInput(round(option, precision), locale, precision)}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
      {showProblem && entry.kind === 'invalid' ? (
        <p id={messageId} className="atonota-number-message">
          {messages.invalid}
        </p>
      ) : null}
    </div>
  );
}
