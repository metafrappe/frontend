import { HIT_SUFFIX_CLASS } from './engine';

/**
 * R9: `<input>` cannot take a pseudo-element. This invisible suffix puts the antd Input inside the
 * affix wrapper, and the rule applies to the wrapper. Usage: `<Input suffix={<HitSuffix />} />`.
 */
export function HitSuffix() {
  return <span className={HIT_SUFFIX_CLASS} aria-hidden="true" />;
}
