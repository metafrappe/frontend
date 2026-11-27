import type { ScopeBlock } from '../types';
import { MODE_LABEL } from './SurfaceLabels';

/** Kapsam şeridi: kiracı, ortam, kip ve kapsam her zaman görünür. */
export function ScopeView({ block }: { block: ScopeBlock }) {
  return (
    <div data-genui="scope" className="genui-scope" role="group" aria-label="Kapsam">
      <dl data-testid="genui-scope-list">
        <div>
          <dt>Kiracı</dt>
          <dd>{block.tenant}</dd>
        </div>
        <div>
          <dt>Ortam</dt>
          <dd>{block.environment}</dd>
        </div>
        <div>
          <dt>Kip</dt>
          <dd>{MODE_LABEL[block.mode]}</dd>
        </div>
        {block.scope && (
          <div>
            <dt>Kapsam</dt>
            <dd>{block.scope}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
