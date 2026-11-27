export interface FlyoutPositionInput {
  /** Position of the parent item relative to the viewport. */
  anchor: { top: number; height: number };
  /** x position of the sidebar's right edge relative to the viewport. */
  sidebarRight: number;
  flyoutHeight: number;
  viewportHeight: number;
  gap: number;
  clampPadding: number;
}

export interface FlyoutPosition {
  left: number;
  top: number;
  /** Vertical position of the arrow relative to the flyout's top edge. */
  caret: number;
}

/** Applies the F1–F3 rules. Pure function. */
export function flyoutPosition(input: FlyoutPositionInput): FlyoutPosition {
  const { anchor, sidebarRight, flyoutHeight, viewportHeight, gap, clampPadding } = input;
  const center = anchor.top + anchor.height / 2;
  const ideal = center - flyoutHeight / 2;
  const max = viewportHeight - flyoutHeight - clampPadding;
  const top = Math.max(clampPadding, Math.min(ideal, max));
  return { left: sidebarRight + gap, top, caret: center - top };
}
