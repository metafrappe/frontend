import { parseAgentEvent } from './events';
import type { AgentStep } from './types';

/**
 * Six-step flow (AJA-880 draft, version 3).
 * Steps only move forward. The screen reads this state. It does not create steps itself.
 */
export const FLOW_STEPS = ['intent', 'plan', 'preview', 'approval', 'apply', 'undo'] as const;
export type FlowStep = (typeof FLOW_STEPS)[number];

export const STEP_LABELS: Record<FlowStep, string> = {
  intent: 'Niyet',
  plan: 'Plan',
  preview: 'Önizleme',
  approval: 'Onay',
  apply: 'Uygulama',
  undo: 'Geri alma önerisi',
};

/** Modes. Only the `act` mode can make changes. */
export const AGENT_MODES = ['ask', 'search', 'draft', 'act'] as const;
export type AgentMode = (typeof AGENT_MODES)[number];

export const MODE_LABELS: Record<AgentMode, string> = {
  ask: 'Sor',
  search: 'Ara',
  draft: 'Taslak hazırla',
  act: 'İşlem yap',
};

export interface FlowState {
  mode: AgentMode;
  step: FlowStep;
  /** Built only from server events. Each key appears once. */
  tools: AgentStep[];
  /** User approval. Given only at the `approval` step. */
  approved: boolean;
  /** Undo endpoint reported by the backend. Without it the undo step does not open. */
  undoEndpoint?: string;
}

/**
 * Server events that concern the flow.
 * Objects are rebuilt from allowed fields. Confidence percentages and inner thoughts are not carried.
 */
export type FlowEvent =
  | {
      type: 'tool';
      key: string;
      tool: AgentStep['tool'];
      title: string;
      status: AgentStep['status'];
    }
  | { type: 'step'; step: FlowStep }
  | { type: 'undo'; endpoint: string };

const ACT_ONLY: ReadonlySet<FlowStep> = new Set(['approval', 'apply', 'undo']);

function isObj(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFlowStep(value: unknown): value is FlowStep {
  return typeof value === 'string' && (FLOW_STEPS as readonly string[]).includes(value);
}

/** The undo endpoint is a relative path on our own backend. An address to another site is rejected. */
function isUndoEndpoint(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= 500 &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.includes('\\')
  );
}

/**
 * Validates a single SSE `data` line.
 * Only text lines are read. An invalid or unrecognised event returns `null`.
 */
export function parseFlowEvent(data: unknown): FlowEvent | null {
  if (typeof data !== 'string') return null;
  let raw: unknown;
  try {
    raw = JSON.parse(data);
  } catch {
    return null;
  }
  if (!isObj(raw)) return null;
  switch (raw['type']) {
    case 'tool': {
      const event = parseAgentEvent(data);
      if (event?.type !== 'tool') return null;
      return {
        type: 'tool',
        key: event.key,
        tool: event.tool,
        title: event.title,
        status: event.status,
      };
    }
    case 'step':
      return isFlowStep(raw['step']) ? { type: 'step', step: raw['step'] } : null;
    case 'undo':
      return isUndoEndpoint(raw['endpoint']) ? { type: 'undo', endpoint: raw['endpoint'] } : null;
    default:
      return null;
  }
}

export function createFlow(mode: AgentMode = 'ask'): FlowState {
  return { mode, step: 'intent', tools: [], approved: false };
}

/** The mode changes only at the intent step. */
export function setFlowMode(state: FlowState, mode: AgentMode): FlowState {
  if (state.step !== 'intent' || state.mode === mode) return state;
  if (!(AGENT_MODES as readonly string[]).includes(mode)) return state;
  return { ...state, mode };
}

/** User approval. Valid only in `act` mode and at the approval step. */
export function approveFlow(state: FlowState): FlowState {
  if (state.mode !== 'act' || state.step !== 'approval' || state.approved) return state;
  return { ...state, approved: true };
}

function canEnter(state: FlowState, target: FlowStep): boolean {
  if (FLOW_STEPS.indexOf(target) <= FLOW_STEPS.indexOf(state.step)) return false;
  if (ACT_ONLY.has(target) && state.mode !== 'act') return false;
  // The approval step does not open without a preview. Apply does not open without approval.
  if (target === 'approval') return state.step === 'preview';
  if (target === 'apply') return state.step === 'approval' && state.approved;
  // Only the `undo` event opens the undo step. It does not open without a known endpoint.
  if (target === 'undo') return false;
  return true;
}

function upsertTool(tools: AgentStep[], event: Extract<FlowEvent, { type: 'tool' }>): AgentStep[] {
  const next: AgentStep = {
    key: event.key,
    tool: event.tool,
    title: event.title,
    status: event.status,
  };
  const old = tools.find((t) => t.key === next.key);
  if (!old) return [...tools, next];
  if (old.tool === next.tool && old.title === next.title && old.status === next.status) {
    return tools;
  }
  return tools.map((t) => (t === old ? next : t));
}

/**
 * Applies a single line from the server to the flow.
 * Tool events enter the list only here. The client does not create tool events.
 */
export function receiveServerEvent(state: FlowState, data: string): FlowState {
  const event = parseFlowEvent(data);
  if (!event) return state;
  switch (event.type) {
    case 'tool': {
      const tools = upsertTool(state.tools, event);
      return tools === state.tools ? state : { ...state, tools };
    }
    case 'step':
      return canEnter(state, event.step) ? { ...state, step: event.step } : state;
    case 'undo':
      if (state.mode !== 'act' || state.step !== 'apply') return state;
      return { ...state, step: 'undo', undoEndpoint: event.endpoint };
  }
}
