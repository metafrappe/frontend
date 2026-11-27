/**
 * Touch area calculation (source: hitArea.rules R1–R10, hitArea.algorithm).
 * This file does not touch the DOM; it only does pure maths. The DOM side lives in engine.ts.
 */
import { hitArea as hitAreaTokens } from '@/design/tokens';

export interface Box {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}

export interface Extension {
  t: number;
  r: number;
  b: number;
  l: number;
}

export interface HitTarget {
  id: string;
  box: Box;
  /** R6: a disabled or hidden control does not expand. */
  active: boolean;
  /** R8: border widths; measured from the border box and added to the offset. */
  border?: Partial<Extension>;
  /** R5: ID of the parent target. If set, this target is left out of the calculation. */
  parentId?: string;
}

export interface Obstacle {
  box: Box;
  active: boolean;
}

export interface HitResult {
  id: string;
  active: boolean;
  /** Pure expansion limited by neighbours (border excluded). */
  extension: Extension;
  /** Value written to the CSS variables: expansion + border. */
  offset: Extension;
  visible: { width: number; height: number };
  hit: { width: number; height: number };
  limitedByNeighbour: boolean;
  /** R10: clickable height ≥ minTarget. */
  meetsMinTarget: boolean;
}

export interface ComputeOptions {
  /** Page edge limit (a special case of R3): expansion cannot cross these edges. */
  bounds?: { left?: number; right?: number; top?: number; bottom?: number };
  expand?: number;
  minTarget?: number;
  /** Overlap (px) needed for two boxes to count as the same row or column. */
  epsilon?: number;
}

export const EPSILON = 0.5;

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function box(left: number, top: number, width: number, height: number): Box {
  return { left, top, width, height, right: left + width, bottom: top + height };
}

function overlapLength(a1: number, a2: number, b1: number, b2: number): number {
  return Math.min(a2, b2) - Math.max(a1, b1);
}

/** R1 + R2: ideal expansion of each edge when there is no neighbour. */
export function idealExtension(b: Box, expand: number): Extension {
  const dx = (b.width * expand) / 2;
  const dy = (b.height * expand) / 2;
  return { t: dy, r: dx, b: dy, l: dx };
}

/** R3 + R4: limits the edge facing a neighbour to half the gap; 0 if the gap is ≤ 0. */
export function limitByNeighbour(ext: Extension, a: Box, b: Box, epsilon = EPSILON): void {
  const sameRow = overlapLength(a.top, a.bottom, b.top, b.bottom) > epsilon;
  const sameCol = overlapLength(a.left, a.right, b.left, b.right) > epsilon;
  if (!sameRow && !sameCol) return; // diagonal neighbour: no effect
  const acx = (a.left + a.right) / 2;
  const acy = (a.top + a.bottom) / 2;
  const bcx = (b.left + b.right) / 2;
  const bcy = (b.top + b.bottom) / 2;
  const horizontal =
    sameRow && !sameCol
      ? true
      : sameCol && !sameRow
        ? false
        : Math.abs(bcx - acx) / (a.width + b.width) >= Math.abs(bcy - acy) / (a.height + b.height);
  if (horizontal) {
    if (bcx > acx) ext.r = Math.min(ext.r, Math.max(0, (b.left - a.right) / 2));
    else ext.l = Math.min(ext.l, Math.max(0, (a.left - b.right) / 2));
  } else {
    if (bcy > acy) ext.b = Math.min(ext.b, Math.max(0, (b.top - a.bottom) / 2));
    else ext.t = Math.min(ext.t, Math.max(0, (a.top - b.bottom) / 2));
  }
}

/** Calculates the expansion for all targets. */
export function computeHitAreas(
  targets: readonly HitTarget[],
  obstacles: readonly Obstacle[] = [],
  options: ComputeOptions = {},
): HitResult[] {
  const expand = options.expand ?? hitAreaTokens.expand;
  const minTarget = options.minTarget ?? hitAreaTokens.minTarget;
  const epsilon = options.epsilon ?? EPSILON;

  // R5: targets inside another target are dropped; the outer target covers them.
  const ids = new Set(targets.map((t) => t.id));
  const topLevel = targets.filter((t) => !(t.parentId && ids.has(t.parentId)));

  return topLevel.map((a) => {
    const visible = { width: a.box.width, height: a.box.height };
    if (!a.active) {
      const zero = { t: 0, r: 0, b: 0, l: 0 };
      return {
        id: a.id,
        active: false,
        extension: zero,
        offset: zero,
        visible,
        hit: visible,
        limitedByNeighbour: false,
        meetsMinTarget: visible.height >= minTarget,
      };
    }
    const ideal = idealExtension(a.box, expand);
    const ext: Extension = { ...ideal };
    for (const b of topLevel) {
      if (b === a || !b.active) continue;
      limitByNeighbour(ext, a.box, b.box, epsilon);
    }
    for (const o of obstacles) {
      if (!o.active) continue;
      limitByNeighbour(ext, a.box, o.box, epsilon);
    }
    if (options.bounds) {
      const { left, right, top, bottom } = options.bounds;
      if (left !== undefined) ext.l = Math.min(ext.l, Math.max(0, a.box.left - left));
      if (right !== undefined) ext.r = Math.min(ext.r, Math.max(0, right - a.box.right));
      if (top !== undefined) ext.t = Math.min(ext.t, Math.max(0, a.box.top - top));
      if (bottom !== undefined) ext.b = Math.min(ext.b, Math.max(0, bottom - a.box.bottom));
    }
    const border = { t: 0, r: 0, b: 0, l: 0, ...a.border };
    const hit = { width: a.box.width + ext.l + ext.r, height: a.box.height + ext.t + ext.b };
    return {
      id: a.id,
      active: true,
      extension: ext,
      offset: {
        t: ext.t + border.t,
        r: ext.r + border.r,
        b: ext.b + border.b,
        l: ext.l + border.l,
      },
      visible,
      hit,
      limitedByNeighbour: (['t', 'r', 'b', 'l'] as const).some((k) => ideal[k] - ext[k] > 0.01),
      meetsMinTarget: hit.height >= minTarget,
    };
  });
}
