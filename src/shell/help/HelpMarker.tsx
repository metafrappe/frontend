import { Question } from '@phosphor-icons/react';

import { t } from '../messages';
import type { HelpTarget } from './context';
import { useHelp } from './context';

/**
 * Yardım işareti. Yalnız kendi kendine destek modu açıkken görünür.
 * Alan işareti ekran okuyucuya alan adıyla duyurulur. Örnek: "Başlık alanının yardımı".
 */
export function HelpMarker({ target }: { target: HelpTarget }) {
  const help = useHelp();
  if (!help?.selfHelp) return null;
  if (target.kind === 'page') {
    return (
      <button
        type="button"
        className="shell-help-page"
        onClick={(e) => help.open(target, e.currentTarget)}
      >
        <Question aria-hidden="true" />
        {t.help.pageMarker}
      </button>
    );
  }
  return (
    <button
      type="button"
      className="shell-iconbtn shell-help-mark"
      aria-label={t.help.fieldMarker(target.label)}
      onClick={(e) => help.open(target, e.currentTarget)}
    >
      <Question aria-hidden="true" />
    </button>
  );
}
