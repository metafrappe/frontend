import type { ReviewBlock } from '../types';
import { ChangeTable } from './ChangeTable';
import { SourceList } from './SourceList';
import { useGenuiStrings } from '../useGenuiStrings';
import { RISK_TONE } from './SurfaceLabels';

/**
 * Değişiklik incelemesi: özet, risk düzeyi, hedef, geri alma ve önce-sonra tablosu.
 * Salt okunurdur. Onay düğmesi onay kartındadır (6b işi).
 */
export function ReviewView({ block }: { block: ReviewBlock }) {
  const text = useGenuiStrings();
  return (
    <div
      data-genui="review"
      className={`genui-card genui-diff-review${block.risk === 'R3' ? ' is-r3' : ''}`}
      role="group"
      aria-label={text.review}
    >
      <p className="genui-diff-summary">
        <strong>{block.summary}</strong>
      </p>
      <dl className="genui-facts">
        <dt>{text.riskLevel}</dt>
        <dd>
          <span className={`genui-badge is-${RISK_TONE[block.risk]}`}>
            {text.riskLabels[block.risk]}
          </span>
        </dd>
        <dt>{text.targetRecord}</dt>
        <dd>{block.target}</dd>
        <dt>{text.reversible}</dt>
        <dd>{block.reversible}</dd>
      </dl>
      <ChangeTable changes={block.changes} />
      <div className="genui-source">
        <div>
          <strong>{text.source}</strong>
          <SourceList items={block.sources ?? []} />
        </div>
      </div>
    </div>
  );
}
