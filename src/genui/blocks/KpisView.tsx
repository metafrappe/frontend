import { TrendDown, TrendUp } from '@phosphor-icons/react';

import { useGenuiStrings } from '../useGenuiStrings';
import type { KpisBlock } from '../types';

export function KpisView({ block }: { block: KpisBlock }) {
  const text = useGenuiStrings();
  return (
    <section data-genui="kpis" className="genui-kpis" aria-label={text.kpis}>
      {block.items.map((item) => {
        const hasDelta = item.delta !== undefined;
        const up = (item.delta ?? 0) >= 0;
        const good = item.goodWhen === 'down' ? !up : up;
        const sign = up ? '+' : '';
        return (
          <div key={item.label} className="genui-kpi">
            <span className="genui-kpi-label">{item.label}</span>
            <strong className="genui-kpi-value">{item.value}</strong>
            {hasDelta && (
              <span className={`genui-delta ${good ? 'is-good' : 'is-bad'}`}>
                {up ? <TrendUp aria-hidden /> : <TrendDown aria-hidden />}
                {`${sign}${item.delta}${item.unit ?? ''}`}
              </span>
            )}
          </div>
        );
      })}
    </section>
  );
}
