import type { ScopeBlock } from '../types';
import { MODE_LABEL } from './SurfaceLabels';

/** Scope strip: tenant, environment, mode and scope are always visible. */
export function ScopeView({ block }: { block: ScopeBlock }) {
  return (
    <div data-genui="scope" className="genui-scope" role="group" aria-label="Kapsam">
      <dl>
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
