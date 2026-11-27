import type { Icon } from '@phosphor-icons/react';
import {
  ChartBarHorizontal,
  ChartPieSlice,
  FileText,
  Kanban,
  Rows,
  Table,
  Timer,
} from '@phosphor-icons/react';

import type { ViewType } from '../tokens';

/** Mapping for `header.viewTypes[].icon` in the source file. */
export const viewIcons: Record<ViewType, Icon> = {
  table: Rows,
  kanban: Kanban,
  pivot: Table,
  report: ChartPieSlice,
  gantt: ChartBarHorizontal,
  timesheet: Timer,
  form: FileText,
};
