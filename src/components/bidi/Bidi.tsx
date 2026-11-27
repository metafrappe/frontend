/**
 * Direction isolation for dynamic text (AJA-1747).
 *
 * A dynamic value inside a sentence is isolated with `<bdi>`. The browser then lays out the value
 * on its own and the sentence direction cannot reorder it. No invisible direction mark (LRM, RLM,
 * LRI, PDI) is added to the text, so a copied value is byte-for-byte the stored value.
 */
import type { ComponentPropsWithoutRef } from 'react';

type BdiProps = Omit<ComponentPropsWithoutRef<'bdi'>, 'dir'>;

/**
 * A commercial code such as `AB-120/XL`. Codes are always written left to right. The text is never
 * changed for display: no hyphen, space or invisible character is added. `translate="no"` keeps
 * browser translation away from the code.
 */
export function CommercialCode({
  children,
  className,
  ...rest
}: Omit<BdiProps, 'children'> & { children: string }) {
  const classes = className ? `commercial-code ${className}` : 'commercial-code';
  return (
    <bdi {...rest} dir="ltr" translate="no" className={classes}>
      {children}
    </bdi>
  );
}

/**
 * Any other dynamic value inside a sentence, for example a number with a sign. `dir="auto"` takes the
 * direction from the first strong letter. Numbers and codes pass `dir="ltr"`.
 */
export function Isolate({ dir = 'auto', ...rest }: BdiProps & { dir?: 'ltr' | 'rtl' | 'auto' }) {
  return <bdi {...rest} dir={dir} />;
}
