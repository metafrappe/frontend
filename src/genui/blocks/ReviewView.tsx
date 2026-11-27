import type { ReviewBlock } from '../types';
import { ChangeTable } from './ChangeTable';
import { SourceList } from './SourceList';
import { RISK_LABEL, RISK_TONE } from './SurfaceLabels';

/**
 * Change review: summary, risk level, target, undo and a before/after table.
 * Read-only. The approve button lives on the confirm card (task 6b).
 */
export function ReviewView({ block }: { block: ReviewBlock }) {
  return (
    <div
      data-genui="review"
      className={`genui-card genui-diff-review${block.risk === 'R3' ? ' is-r3' : ''}`}
      role="group"
      aria-label="Değişiklik önerisi"
    >
      <p className="genui-diff-summary">
        <strong>{block.summary}</strong>
      </p>
      <dl className="genui-facts">
        <dt>Risk düzeyi</dt>
        <dd>
          <span className={`genui-badge is-${RISK_TONE[block.risk]}`}>
            {RISK_LABEL[block.risk]}
          </span>
        </dd>
        <dt>Hedef kayıt</dt>
        <dd>{block.target}</dd>
        <dt>Geri alınabilir mi?</dt>
        <dd>{block.reversible}</dd>
      </dl>
      <ChangeTable changes={block.changes} />
      <div className="genui-source">
        <div>
          <strong>Kaynak</strong>
          <SourceList items={block.sources ?? []} />
        </div>
      </div>
    </div>
  );
}
