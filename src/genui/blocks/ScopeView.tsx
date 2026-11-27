import type { ScopeBlock } from '../types';
import { useGenuiStrings } from '../useGenuiStrings';

/** Kapsam şeridi: kiracı, ortam, kip ve kapsam her zaman görünür. */
export function ScopeView({ block }: { block: ScopeBlock }) {
  const text = useGenuiStrings();
  return (
    <div data-genui="scope" className="genui-scope" role="group" aria-label={text.scope.name}>
      <dl>
        <div>
          <dt>{text.scope.tenant}</dt>
          <dd>{block.tenant}</dd>
        </div>
        <div>
          <dt>{text.scope.environment}</dt>
          <dd>{block.environment}</dd>
        </div>
        <div>
          <dt>{text.scope.mode}</dt>
          <dd>{text.modeLabels[block.mode]}</dd>
        </div>
        {block.scope && (
          <div>
            <dt>{text.scope.scope}</dt>
            <dd>{block.scope}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
