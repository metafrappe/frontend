/**
 * Shared text input rules (AJA-1764, G-73). The `Input` and `Input.TextArea` controls use them.
 *
 * 1. The limit counts perceived characters with `Intl.Segmenter`, not `string.length`.
 *    The text is cut at a character boundary. The native `maxlength` attribute is not set,
 *    because it counts UTF-16 code units and could split an emoji.
 * 2. The counter tells a screen reader how many characters are left.
 * 3. While the keyboard's candidate window (IME) is open, Enter does not submit the form
 *    and does not call `onPressEnter`. Example: a Japanese or Chinese keyboard.
 */
import type { InputProps } from 'antd';
import { useId, useMemo } from 'react';
import type { KeyboardEvent, KeyboardEventHandler, ReactNode } from 'react';

import { useLanguage, useLocaleBundle, type AppLanguage } from '@/app/locale';

import messages from './messages.json';
import { countGraphemes, truncateGraphemes } from './text-count';

type CountConfig = NonNullable<InputProps['count']>;
type Catalog = Record<string, Partial<Record<Intl.LDMLPluralRule, string>>>;

/** Safari sends keyCode 229 for the Enter key that closes the candidate window. */
const IME_KEY_CODE = 229;

/** True when the key event belongs to an open candidate window (IME). */
export function isComposingKey(event: KeyboardEvent): boolean {
  return event.nativeEvent.isComposing || event.keyCode === IME_KEY_CODE;
}

function remainingText(language: AppLanguage, intl: string, remaining: number): string {
  const entry = (messages as Record<string, Catalog>)[language]?.['controls.textCount.remaining'];
  const rule = new Intl.PluralRules(intl).select(remaining);
  const template = entry?.[rule] ?? entry?.other ?? '{count}';
  return template.replace('{count}', new Intl.NumberFormat(intl).format(remaining));
}

interface TextRuleProps<E extends HTMLInputElement | HTMLTextAreaElement> {
  maxLength?: number | undefined;
  showCount?: InputProps['showCount'];
  count?: CountConfig | undefined;
  onPressEnter?: KeyboardEventHandler<E> | undefined;
  onKeyDown?: KeyboardEventHandler<E> | undefined;
  'aria-describedby'?: string | undefined;
}

/** Returns the props that replace `maxLength`, `showCount`, `count`, `onPressEnter` and `onKeyDown`. */
export function useTextRules<E extends HTMLInputElement | HTMLTextAreaElement>(
  props: TextRuleProps<E>,
) {
  const { maxLength, showCount, count, onPressEnter, onKeyDown } = props;
  const describedBy = props['aria-describedby'];
  const bundle = useLocaleBundle();
  const language = useLanguage();
  const statusId = useId();
  const max =
    count?.max ?? (typeof maxLength === 'number' && maxLength > 0 ? maxLength : undefined);
  const announce = Boolean(showCount || count?.show) && max !== undefined;

  const countConfig = useMemo<CountConfig | undefined>(() => {
    if (max === undefined && !count) return undefined;
    const strategy = count?.strategy ?? ((text: string) => countGraphemes(text, bundle.intl));
    const userShow = count?.show ?? showCount;
    const show: CountConfig['show'] =
      !userShow || max === undefined
        ? Boolean(userShow)
        : ({ value, count: used, maxLength: limit }): ReactNode => {
            const limitValue = limit ?? max;
            const formatter =
              typeof userShow === 'function'
                ? userShow
                : typeof userShow === 'object'
                  ? userShow.formatter
                  : undefined;
            const base = formatter
              ? formatter({ value, count: used, maxLength: limitValue })
              : `${used} / ${limitValue}`;
            return (
              <>
                <span aria-hidden="true">{base}</span>
                <span id={statusId} role="status" className="atonota-visually-hidden">
                  {remainingText(language, bundle.intl, Math.max(limitValue - used, 0))}
                </span>
              </>
            );
          };
    return {
      ...count,
      ...(max === undefined ? {} : { max }),
      strategy,
      exceedFormatter:
        count?.exceedFormatter ??
        ((text: string, { max: limit }: { max: number }) =>
          truncateGraphemes(text, limit, bundle.intl)),
      show,
    };
  }, [bundle.intl, count, language, max, showCount, statusId]);

  return {
    ...(countConfig ? { count: countConfig } : {}),
    'aria-describedby': announce ? [describedBy, statusId].filter(Boolean).join(' ') : describedBy,
    onPressEnter: (event: KeyboardEvent<E>) => {
      if (!isComposingKey(event)) onPressEnter?.(event);
    },
    onKeyDown: (event: KeyboardEvent<E>) => {
      // A cancelled Enter keydown stops the browser's implicit form submission.
      if (event.key === 'Enter' && isComposingKey(event)) event.preventDefault();
      onKeyDown?.(event);
    },
  };
}
