import type { EventsBlock, GenUIBlock, ToolEventStatus } from '@/genui';

import { STEP_LABELS } from '../agent';
import type { AgentStep, FlowStep } from '../agent';

/** The mock server's tool events are examples. The screen says so clearly (AX-7). */
export const SIMULATED_TOOLS_NOTE = 'Örnek adımlar. Gerçek araç çalışmadı.';

const STATUS: Record<AgentStep['status'], ToolEventStatus> = {
  pending: 'running',
  success: 'done',
  error: 'failed',
};

/**
 * Turns the tool events reported by the server into the approved tool events surface.
 * If the list is empty there is no surface. The screen adds no events on its own.
 */
export function toEventsBlock(steps: readonly AgentStep[]): EventsBlock | null {
  if (steps.length === 0) return null;
  return {
    type: 'events',
    items: steps.map((step) => ({
      id: step.key,
      tool: step.tool,
      summary: step.title,
      status: STATUS[step.status],
    })),
  };
}

/** Flow step the surface belongs to. A block not on the list has no step. */
const STEP_OF: Partial<Record<GenUIBlock['type'], FlowStep>> = {
  scope: 'plan',
  events: 'plan',
  review: 'preview',
  source: 'preview',
  queue: 'approval',
  confirm: 'approval',
  result: 'apply',
};

export interface StepGroup {
  step: FlowStep;
  label: string;
  blocks: GenUIBlock[];
}

/**
 * Splits the reply's blocks into flow steps.
 * Tool events go in the reply's first step, after that step's surfaces.
 * Blocks without a step (table, chart, form) keep their order in the `rest` list.
 */
export function groupBySteps(
  blocks: readonly GenUIBlock[],
  steps: readonly AgentStep[],
): { groups: StepGroup[]; rest: GenUIBlock[] } {
  const byStep = new Map<FlowStep, GenUIBlock[]>();
  const rest: GenUIBlock[] = [];
  const add = (step: FlowStep, block: GenUIBlock) =>
    byStep.set(step, [...(byStep.get(step) ?? []), block]);
  for (const block of blocks) {
    const step = STEP_OF[block.type];
    if (step) add(step, block);
    else rest.push(block);
  }
  const order: FlowStep[] = ['plan', 'preview', 'approval', 'apply'];
  // Tool events belong to this reply's first step. If the reply has no surface, they go in the plan step.
  // Example: in the reply after approval, the event shows under the apply step heading.
  const events = toEventsBlock(steps);
  if (events) add(order.find((step) => byStep.has(step)) ?? 'plan', events);
  const groups = order
    .filter((step) => byStep.has(step))
    .map((step) => ({ step, label: STEP_LABELS[step], blocks: byStep.get(step) ?? [] }));
  return { groups, rest };
}
