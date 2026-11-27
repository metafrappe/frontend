/**
 * Plan detail demo page (AJA-1744). Opens only in the e2e build at `/_demo/plan-detail`.
 * The plans are test data from `plan-fixture.ts`; the cards mark them as sample data.
 */
import { useState } from 'react';

import { PlanComparison, PlanDetail } from '../PlanDetail';
import { LONG_ERROR, TEST_PLANS } from '../plan-fixture';

export default function PlanDetailDemoPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [errorPlan] = TEST_PLANS;
  return (
    // The shell's page contract: `.shell-body` scrolls in the wide layout.
    <div className="shell-page">
      <div className="shell-body module-stack plan-demo">
        <h1>Plan ayrıntısı denemesi</h1>
        <div id="plan-slot">
          <PlanComparison plans={TEST_PLANS} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
        <p>
          Seçilen kimlik: <output data-testid="selected-plan-id">{selectedId ?? ''}</output>
        </p>
        {errorPlan && (
          <div id="plan-error-slot">
            <PlanDetail
              plan={errorPlan}
              selected={false}
              onSelect={() => undefined}
              error={LONG_ERROR}
            />
          </div>
        )}
      </div>
    </div>
  );
}
