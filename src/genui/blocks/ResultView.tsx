import { CheckCircle, Question, XCircle } from '@phosphor-icons/react';

import type { ResultBlock, ResultOutcome } from '../types';
import { useGenuiStrings } from '../useGenuiStrings';

const ICON: Record<ResultOutcome, typeof CheckCircle> = {
  succeeded: CheckCircle,
  failed: XCircle,
  unknown: Question,
};

/** Sonuç kartı. Sonuç "başarılı", "başarısız" ya da "bilinmiyor" olur. */
export function ResultView({ block }: { block: ResultBlock }) {
  const text = useGenuiStrings();
  const Icon = ICON[block.outcome];
  return (
    <div
      data-genui="result"
      className={`genui-card genui-result is-${block.outcome}`}
      role="status"
    >
      <Icon aria-hidden />
      <p>
        <strong>{text.outcomeLabels[block.outcome]}</strong> {block.summary}
      </p>
    </div>
  );
}
