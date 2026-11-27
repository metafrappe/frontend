import type { ComponentType } from 'react';

import { ChartView } from './blocks/ChartView';
import { ChoicesView } from './blocks/ChoicesView';
import { ConfirmView } from './blocks/ConfirmView';
import { EventsView } from './blocks/EventsView';
import { FormView } from './blocks/FormView';
import { KpisView } from './blocks/KpisView';
import { QueueView } from './blocks/QueueView';
import { ResultView } from './blocks/ResultView';
import { ReviewView } from './blocks/ReviewView';
import { ScopeView } from './blocks/ScopeView';
import { SourceView } from './blocks/SourceView';
import { TableView } from './blocks/TableView';
import type { BlockType, GenUIActionHandler, GenUIDecision, KnownBlock } from './types';

export interface BlockProps<T extends KnownBlock> {
  block: T;
  onAction: GenUIActionHandler;
  /** `true` while the chat awaits a reply. Action buttons are disabled. */
  busy?: boolean;
  /** Decision from chat history. If present, the block is drawn locked. */
  decided?: GenUIDecision | undefined;
}

type Registry = {
  [K in BlockType]: ComponentType<BlockProps<Extract<KnownBlock, { type: K }>>>;
};

/**
 * Approved component registry (U2). A new type is drawn only once added here.
 * An unregistered type is never drawn (`GenUI.tsx`).
 */
export const GENUI_REGISTRY: Registry = {
  kpis: KpisView,
  chart: ChartView,
  table: TableView,
  confirm: ConfirmView,
  form: FormView,
  choices: ChoicesView,
  // AI surfaces (AJA-1156). The confirm card is not in this list (task 6b).
  scope: ScopeView,
  events: EventsView,
  source: SourceView,
  review: ReviewView,
  queue: QueueView,
  result: ResultView,
};
