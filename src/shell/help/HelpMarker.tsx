import { Question } from '@phosphor-icons/react';

import { t } from '../messages';
import type { HelpTarget } from './context';
import { useHelp, useHelpDoctype } from './context';

/**
 * Yardım işareti. Yalnız kendi kendine destek modu açıkken görünür.
 * Alan işareti ekran okuyucuya alan adıyla duyurulur. Örnek: "Başlık alanının yardımı".
 * Bileşen işareti bileşen adıyla duyurulur. Örnek: "Kayıt formu bileşeninin yardımı".
 */
export function HelpMarker({ target }: { target: HelpTarget }) {
  const help = useHelp();
  const doctype = useHelpDoctype();
  if (!help?.selfHelp) return null;
  // Alan işareti belge türünü kayıt görünümünün bağlamından alır (`HelpDoctype`).
  const subject =
    target.kind === 'field' && !target.doctype && doctype ? { ...target, doctype } : target;
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
      aria-label={
        subject.kind === 'field'
          ? t.help.fieldMarker(target.label)
          : t.help.componentMarker(target.label)
      }
      onClick={(e) => help.open(subject, e.currentTarget)}
    >
      <Question aria-hidden="true" />
    </button>
  );
}
