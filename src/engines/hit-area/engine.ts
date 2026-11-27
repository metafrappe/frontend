/**
 * Touch area engine: the DOM side (R7, R8, R9 and algorithm steps 1–7).
 * The maths lives in compute.ts. This file collects and measures the targets and
 * writes the `--hit-t/r/b/l` variables. The source CSS draws the `::after` layer.
 */
import { hitArea as hitAreaTokens } from '@/design/tokens';

import { computeHitAreas, round2, type Box, type HitResult, type HitTarget } from './compute';

/** Algorithm step 1 + C4: buttons, input wrappers, selects, links and choice controls. */
export const HIT_TARGET_SELECTOR = [
  '.ant-btn',
  '.ant-input-affix-wrapper',
  '.ant-select',
  'a.tlink',
  '[data-hit-target]',
  '.ant-checkbox-wrapper',
  '.ant-radio-wrapper',
  '.ant-radio-button-wrapper',
  '.ant-switch',
  '.ant-tabs-tab',
  '.ant-segmented-item',
].join(', ');

/** Obstacle: not a target and does not expand; target expansion does not spill over it (R3). */
export const HIT_OBSTACLE_SELECTOR = '[data-hit-obstacle]';

/** R6: disabled controls. */
export const HIT_DISABLED_SELECTOR = [
  '[disabled]',
  '[aria-disabled="true"]',
  '.ant-btn-disabled',
  '.ant-input-affix-wrapper-disabled',
  '.ant-select-disabled',
  '.ant-checkbox-wrapper-disabled',
  '.ant-radio-wrapper-disabled',
  '.ant-switch-disabled',
  '.ant-segmented-item-disabled',
].join(', ');

/** R9: invisible suffix class for Input. The source CSS hides `.ant-input-suffix:has(> .hit-sfx)`. */
export const HIT_SUFFIX_CLASS = 'hit-sfx';
export const HIT_CLASS = 'hit';
export const HIT_UPDATE_EVENT = 'hitarea:update';

export interface HitAreaEngineOptions {
  root?: ParentNode & Node;
  expand?: number;
  minTarget?: number;
}

function toBox(r: DOMRect): Box {
  return {
    top: r.top,
    right: r.right,
    bottom: r.bottom,
    left: r.left,
    width: r.width,
    height: r.height,
  };
}

/** R5: targets that are not inside another target. */
export function collectTargets(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(HIT_TARGET_SELECTOR)).filter(
    (el) => !el.parentElement?.closest(HIT_TARGET_SELECTOR),
  );
}

function isActive(el: HTMLElement, box: Box): boolean {
  return box.width > 0 && box.height > 0 && !el.matches(HIT_DISABLED_SELECTOR);
}

function borderOf(el: HTMLElement) {
  const cs = getComputedStyle(el);
  const n = (v: string) => parseFloat(v) || 0;
  return {
    t: n(cs.borderTopWidth),
    r: n(cs.borderRightWidth),
    b: n(cs.borderBottomWidth),
    l: n(cs.borderLeftWidth),
  };
}

/** Writes only when the value changes, so the engine's own writes do not trigger a new run. */
function setVar(el: HTMLElement, name: string, value: string): boolean {
  if (el.style.getPropertyValue(name) === value) return false;
  el.style.setProperty(name, value);
  return true;
}
function setData(el: HTMLElement, key: string, value: string): boolean {
  if (el.dataset[key] === value) return false;
  el.dataset[key] = value;
  return true;
}

/** R7 + R8 + R10: writes the result to CSS variables and data attributes. Returns true on change. */
export function applyResult(el: HTMLElement, result: HitResult): boolean {
  if (!result.active) {
    return clearElement(el);
  }
  let changed = false;
  if (getComputedStyle(el).position === 'static') {
    el.style.position = 'relative';
    changed = true;
  }
  if (!el.classList.contains(HIT_CLASS)) {
    el.classList.add(HIT_CLASS);
    changed = true;
  }
  changed = setVar(el, '--hit-t', `${round2(result.offset.t)}px`) || changed;
  changed = setVar(el, '--hit-r', `${round2(result.offset.r)}px`) || changed;
  changed = setVar(el, '--hit-b', `${round2(result.offset.b)}px`) || changed;
  changed = setVar(el, '--hit-l', `${round2(result.offset.l)}px`) || changed;
  const e = result.extension;
  changed = setData(el, 'hit', [e.t, e.r, e.b, e.l].map(round2).join(' ')) || changed;
  changed =
    setData(
      el,
      'hitVisible',
      `${round2(result.visible.width)} × ${round2(result.visible.height)}`,
    ) || changed;
  changed =
    setData(el, 'hitArea', `${round2(result.hit.width)} × ${round2(result.hit.height)}`) || changed;
  changed = setData(el, 'hitOk', result.meetsMinTarget ? '1' : '0') || changed;
  changed = setData(el, 'hitLimited', result.limitedByNeighbour ? '1' : '0') || changed;
  return changed;
}

export function clearElement(el: HTMLElement): boolean {
  if (!el.classList.contains(HIT_CLASS) && el.dataset['hit'] === undefined) return false;
  el.classList.remove(HIT_CLASS);
  delete el.dataset['hit'];
  delete el.dataset['hitVisible'];
  delete el.dataset['hitArea'];
  delete el.dataset['hitOk'];
  delete el.dataset['hitLimited'];
  for (const k of ['--hit-t', '--hit-r', '--hit-b', '--hit-l']) {
    el.style.removeProperty(k);
  }
  return true;
}

/** Elements the engine wrote in its last pass. Their style/class mutations do not trigger a new run. */
const writtenByEngine = new WeakSet<Element>();

/** Calculates and applies once. Exported for tests and manual refresh. */
export function computeOnce(options: HitAreaEngineOptions = {}): HitResult[] {
  const root = options.root ?? document;
  const elements = collectTargets(root);
  const byId = new Map<string, HTMLElement>();
  const targets: HitTarget[] = elements.map((el, i) => {
    const id = String(i);
    byId.set(id, el);
    const box = toBox(el.getBoundingClientRect());
    return { id, box, active: isActive(el, box), border: borderOf(el) };
  });
  const obstacles = Array.from(root.querySelectorAll<HTMLElement>(HIT_OBSTACLE_SELECTOR)).map(
    (el) => {
      const box = toBox(el.getBoundingClientRect());
      return { box, active: box.width > 0 && box.height > 0 };
    },
  );
  // Page edge: the touch layer must not cause horizontal scrolling (left and right edges only).
  const computeOptions: {
    expand?: number;
    minTarget?: number;
    bounds?: { left: number; right: number };
  } = {};
  const pageWidth = document.documentElement.clientWidth;
  if (pageWidth > 0) computeOptions.bounds = { left: 0, right: pageWidth };
  if (options.expand !== undefined) computeOptions.expand = options.expand;
  if (options.minTarget !== undefined) computeOptions.minTarget = options.minTarget;
  const results = computeHitAreas(targets, obstacles, computeOptions);
  for (const r of results) {
    const el = byId.get(r.id);
    if (el && applyResult(el, r)) writtenByEngine.add(el);
  }
  document.dispatchEvent(new CustomEvent(HIT_UPDATE_EVENT, { detail: results }));
  return results;
}

/**
 * R11: the Select's +12% layer (::after) belongs to the root element. A click lands on the root
 * and does not reach antd's listener on the selector. The engine relays a mousedown on the root to
 * the selector, so the expanded area also opens the list. A disabled Select is left alone.
 */
export function relaySelectMouseDown(event: MouseEvent): boolean {
  const t = event.target;
  if (!(t instanceof Element) || !t.classList.contains('ant-select')) return false;
  if (t.classList.contains('ant-select-disabled')) return false;
  const selector = t.querySelector<HTMLElement>('.ant-select-selector');
  if (!selector) return false;
  event.stopPropagation();
  event.preventDefault();
  selector.dispatchEvent(
    new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      clientX: event.clientX,
      clientY: event.clientY,
      button: event.button,
    }),
  );
  t.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
  return true;
}

export function installSelectRelay(doc: Document = document): () => void {
  const handler = (ev: MouseEvent) => {
    relaySelectMouseDown(ev);
  };
  doc.addEventListener('mousedown', handler, true);
  return () => doc.removeEventListener('mousedown', handler, true);
}

export interface HitAreaEngine {
  refresh: () => void;
  stop: () => void;
}

/**
 * Algorithm step 7: recalculates on DOM change, resize and font load.
 * Runs once per frame via requestAnimationFrame.
 */
export function startHitAreaEngine(options: HitAreaEngineOptions = {}): HitAreaEngine {
  const root = options.root ?? document;
  const observeRoot: Node = root instanceof Document ? root.body : root;
  let pending = false;
  let stopped = false;

  const run = () => {
    pending = false;
    if (stopped) return;
    computeOnce(options);
  };
  const schedule = () => {
    if (pending || stopped) return;
    pending = true;
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
    else setTimeout(run, 0);
  };

  const onMutations = (records: MutationRecord[]) => {
    const relevant = records.some((rec) => {
      if (rec.type !== 'attributes') return true;
      const target = rec.target;
      // The engine's own style/class and data-hit-* changes must not cause a loop.
      if (target instanceof Element && writtenByEngine.has(target)) {
        const n = rec.attributeName ?? '';
        if (n === 'style' || n === 'class' || n.startsWith('data-hit')) return false;
      }
      return true;
    });
    if (relevant) schedule();
  };
  const mutation =
    typeof MutationObserver !== 'undefined' ? new MutationObserver(onMutations) : null;
  mutation?.observe(observeRoot, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'disabled', 'aria-disabled', 'style'],
  });
  const resize = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
  if (observeRoot instanceof Element) resize?.observe(observeRoot);
  window.addEventListener('resize', schedule);
  const uninstallRelay = installSelectRelay(document);
  const fonts = (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts;
  fonts?.ready.then(schedule, () => undefined);
  schedule();

  return {
    refresh: schedule,
    stop: () => {
      stopped = true;
      mutation?.disconnect();
      resize?.disconnect();
      window.removeEventListener('resize', schedule);
      uninstallRelay();
    },
  };
}

export { hitAreaTokens };
