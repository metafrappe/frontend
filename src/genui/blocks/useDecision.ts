import { useState } from 'react';

import type { GenUIActionResult, GenUIDecision } from '../types';

export const BUSY_NOTE = 'Yanıt bitince onay verebilirsiniz.';
export const FAILED_NOTE = 'Onay gönderilemedi. Yanıt bitince yeniden deneyin.';
export const EXPIRED_LABEL = 'Süresi doldu';
export const EXPIRED_NOTE = 'Bu öneri artık onaylanamaz. Asistandan yeni öneri isteyin.';
export const USED_NOTE = 'Bu onay daha önce gönderildi. İşlem yeniden yapılmadı.';

/**
 * Decision state of confirm and form blocks.
 *
 * A decision comes from two places. The first is chat history (`decided`), so the
 * decision survives a redraw. The second is a decision made in this render.
 * If the chat does not take the decision, the reason is shown on screen.
 */
export function useDecision(decided: GenUIDecision | undefined) {
  const [local, setLocal] = useState<GenUIDecision | null>(null);
  const [notice, setNotice] = useState<Exclude<GenUIActionResult, 'accepted'> | null>(null);
  const decision = decided ?? local;

  const apply = (next: GenUIDecision, result: GenUIActionResult) => {
    if (result === 'accepted') {
      setLocal(next);
      setNotice(null);
    } else {
      setNotice(result);
    }
  };

  return {
    decision,
    notice,
    /** The block is locked if a decision was made or the approval was already used. */
    locked: decision !== null || notice === 'used',
    apply,
  };
}
