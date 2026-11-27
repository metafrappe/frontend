import { CaretDown } from '@phosphor-icons/react';

import { FLOW_STEPS, MODE_LABELS, STEP_LABELS } from '../agent';
import type { FlowState, FlowStep } from '../agent';

/** Steps that open only in `act` mode. */
const ACT_ONLY: ReadonlySet<FlowStep> = new Set(['approval', 'apply', 'undo']);

type StepState = 'done' | 'current' | 'waiting' | 'absent';

const STATE_TEXT: Record<StepState, string> = {
  done: 'Tamamlandı',
  current: 'Şimdi bu adımda',
  waiting: 'Bekliyor',
  absent: 'Bu kipte yok',
};

function stateOf(flow: FlowState, step: FlowStep): StepState {
  const at = FLOW_STEPS.indexOf(flow.step);
  const index = FLOW_STEPS.indexOf(step);
  if (index < at) return 'done';
  if (index === at) return 'current';
  return ACT_ONLY.has(step) && flow.mode !== 'act' ? 'absent' : 'waiting';
}

/**
 * The flow's six steps (AJA-880 draft, version 3).
 * State comes only from server events. No percentage or time estimate is shown.
 * The list starts collapsed. The summary line shows the current step and mode.
 */
export function FlowSteps({ flow }: { flow: FlowState }) {
  const at = FLOW_STEPS.indexOf(flow.step) + 1;
  return (
    <details className="ai-flow">
      <summary>
        <span className="ai-flow-sum">
          <span>{`Adım ${at} / ${FLOW_STEPS.length}: ${STEP_LABELS[flow.step]}`}</span>
          <span className="ai-flow-mode">{`Kip: ${MODE_LABELS[flow.mode]}`}</span>
        </span>
        <CaretDown aria-hidden className="ai-flow-caret" />
      </summary>
      <ol className="ai-flow-list" aria-label="Akış adımları">
        {FLOW_STEPS.map((step) => {
          const state = stateOf(flow, step);
          return (
            <li
              key={step}
              className={`is-${state}`}
              {...(state === 'current' ? { 'aria-current': 'step' as const } : {})}
            >
              <span className="ai-flow-name">{STEP_LABELS[step]}</span>
              <span className="ai-flow-state">{STATE_TEXT[state]}</span>
            </li>
          );
        })}
      </ol>
    </details>
  );
}
