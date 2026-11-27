/**
 * GILT test tool for browser tests (AJA-1742).
 *
 * The tool puts a screen under hard conditions and measures every button:
 * - `applyPseudoLocale`: long, right-to-left or German pseudo text (see `pseudo.ts`).
 * - `openInNarrowContainer`: the component gets a 260 CSS px container.
 * - `scaleRootText`: the root text becomes two times larger.
 * - `findClippedButtons`: a button whose text or box is cut.
 * - `findSmallTargets`: a button whose touch area is below 44 × 44 CSS px.
 * The page width alone is not proof. Each check measures the button's own box.
 */
import type { Page, TestInfo } from '@playwright/test';

import { GERMAN_COMPOUND, isCode, pseudoLong, pseudoRtl } from './pseudo';

/** Width of the narrow container: a desktop side panel (AJA-1728). */
export const NARROW_WIDTH = 260;
/** Root text scale: 200 %. */
export const ROOT_SCALE = 2;
/** Smallest touch area in CSS px. The project's stricter token (48 px on touch) still applies. */
export const MIN_TARGET = 44;
/**
 * What counts as a button. Navigation links that look like buttons carry `data-nav-link`
 * (bottom bar and side menu); `a.ant-btn` is an antd link button.
 */
export const BUTTON_SELECTOR = [
  'button',
  '[role="button"]',
  'input[type="button"]',
  'input[type="submit"]',
  'input[type="reset"]',
  'a.ant-btn',
  'a[data-nav-link]',
].join(', ');

export type PseudoMode = 'long' | 'rtl' | 'german';

export interface CheckOptions {
  /** Only buttons inside this selector are checked. Default: the whole page. */
  scope?: string;
  /** Overrides `BUTTON_SELECTOR`. */
  selector?: string;
}

export interface ButtonProblem {
  /** Marker on the element: `[data-gilt-check="<id>"]`. */
  id: string;
  visibleText: string;
  accessibleName: string;
  box: { x: number; y: number; width: number; height: number };
  reasons: string[];
}

/** Waits for fonts and finite animations. */
export async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      document
        .getAnimations()
        .filter((animation) => Number.isFinite(animation.effect?.getComputedTiming().endTime))
        .map((animation) => animation.finished.catch(() => undefined)),
    );
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

function transform(mode: PseudoMode, text: string): string {
  // Numbers and codes are not translated. Example: the badge "12" stays "12".
  if (text.split(/\s+/).every((word) => word === '' || isCode(word))) return text;
  if (mode === 'rtl') return pseudoRtl(text, { factor: 2 });
  if (mode === 'german') return `${GERMAN_COMPOUND} ${pseudoLong(text, { factor: 2 })}`;
  return pseudoLong(text);
}

/**
 * Replaces the visible text, `aria-label`, `title` and `placeholder` with pseudo text.
 * Code, `pre`, `kbd`, `translate="no"` and form values are not changed.
 * `rtl` also sets `dir="rtl"` on the root element.
 */
export async function applyPseudoLocale(
  page: Page,
  mode: PseudoMode,
  options: { scope?: string } = {},
): Promise<void> {
  const texts = await page.evaluate((scope) => {
    const root = scope ? document.querySelector(scope) : document.body;
    if (!root) throw new Error(`Scope not found: ${scope}`);
    const skip =
      'script, style, code, pre, kbd, samp, textarea, svg, [translate="no"], .notranslate';
    const store: { nodes: Text[]; attrs: [Element, string][] } = { nodes: [], attrs: [] };
    (window as unknown as { __gilt: typeof store }).__gilt = store;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node as Text;
      if (!text.data.trim() || text.parentElement?.closest(skip)) continue;
      store.nodes.push(text);
    }
    for (const el of Array.from(root.querySelectorAll('[aria-label], [title], [placeholder]'))) {
      if (el.closest(skip)) continue;
      for (const name of ['aria-label', 'title', 'placeholder']) {
        if (el.getAttribute(name)?.trim()) store.attrs.push([el, name]);
      }
    }
    return {
      nodes: store.nodes.map((n) => n.data),
      attrs: store.attrs.map(([el, name]) => el.getAttribute(name) ?? ''),
    };
  }, options.scope);
  await page.evaluate(
    ({ nodes, attrs, rtl }) => {
      const store = (window as unknown as { __gilt: { nodes: Text[]; attrs: [Element, string][] } })
        .__gilt;
      store.nodes.forEach((node, i) => (node.data = nodes[i] ?? node.data));
      store.attrs.forEach(([el, name], i) => el.setAttribute(name, attrs[i] ?? ''));
      if (rtl) document.documentElement.dir = 'rtl';
    },
    {
      nodes: texts.nodes.map((text) => transform(mode, text)),
      attrs: texts.attrs.map((text) => transform(mode, text)),
      rtl: mode === 'rtl',
    },
  );
  await settle(page);
}

/**
 * Gives the element a fixed inline size. The element becomes a size container,
 * so container queries inside it see the narrow width. Returns the measured width.
 */
export async function openInNarrowContainer(
  page: Page,
  selector: string,
  width: number = NARROW_WIDTH,
): Promise<number> {
  const measured = await page.evaluate(
    ({ selector, width }) => {
      const el = document.querySelector<HTMLElement>(selector);
      if (!el) throw new Error(`Container not found: ${selector}`);
      for (const name of ['inline-size', 'min-inline-size', 'max-inline-size']) {
        el.style.setProperty(name, `${width}px`);
      }
      el.style.setProperty('flex', '0 0 auto');
      if (getComputedStyle(el).containerType === 'normal') {
        el.style.setProperty('container-type', 'inline-size');
      }
      return el.getBoundingClientRect().width;
    },
    { selector, width },
  );
  await settle(page);
  return measured;
}

/** Makes the root text `scale` times larger than it is now. */
export async function scaleRootText(page: Page, scale: number = ROOT_SCALE): Promise<void> {
  await page.evaluate((scale) => {
    const root = document.documentElement;
    const size = parseFloat(getComputedStyle(root).fontSize);
    root.style.fontSize = `${size * scale}px`;
  }, scale);
  await settle(page);
}

interface RawProblem {
  id: string;
  visibleText: string;
  box: ButtonProblem['box'];
  reasons: string[];
}

async function describe(page: Page, raw: RawProblem[]): Promise<ButtonProblem[]> {
  const out: ButtonProblem[] = [];
  for (const problem of raw) {
    const locator = page.locator(`[data-gilt-check="${problem.id}"]`);
    const snapshot = await locator.ariaSnapshot().catch(() => '');
    const match = /^- [\w-]+ "((?:[^"\\]|\\.)*)"/.exec(snapshot.split('\n')[0] ?? '');
    let name = '';
    if (match?.[1] !== undefined) {
      try {
        name = JSON.parse(`"${match[1]}"`) as string;
      } catch {
        name = match[1];
      }
    }
    out.push({ ...problem, accessibleName: name });
  }
  return out;
}

/**
 * Finds buttons that are cut. Three cases count:
 * 1. A part with hidden overflow has more content than room (for example an ellipsis).
 * 2. A piece of text lies outside the button's own box.
 * 3. A parent with `overflow: hidden` or `clip` cuts the button's box.
 * Scroll containers (`auto`, `scroll`) do not count: the user can scroll to the button.
 */
export async function findClippedButtons(
  page: Page,
  options: CheckOptions = {},
): Promise<ButtonProblem[]> {
  const raw = await page.evaluate(
    ({ scope, selector }) => {
      const root = scope ? document.querySelector(scope) : document.body;
      if (!root) throw new Error(`Scope not found: ${scope}`);
      const tolerance = 1;
      const textTolerance = 2;
      const problems: RawProblem[] = [];
      const hides = (value: string) => value === 'hidden' || value === 'clip';
      const run = String(Date.now() % 1e6);
      let count = 0;
      for (const el of Array.from(root.querySelectorAll<HTMLElement>(selector))) {
        const box = el.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) continue;
        if (!el.checkVisibility({ visibilityProperty: true, opacityProperty: true })) continue;
        const reasons: string[] = [];
        // Screen reader text is hidden on purpose: a box of at most 1 × 1 px.
        const hidden = (node: Element) => {
          for (let n: Element | null = node; n && n !== el.parentElement; n = n.parentElement) {
            const r = n.getBoundingClientRect();
            if (r.width <= 1 || r.height <= 1) return true;
          }
          return false;
        };
        for (const part of [el, ...Array.from(el.querySelectorAll<HTMLElement>('*'))]) {
          if (hidden(part)) continue;
          const style = getComputedStyle(part);
          const x = part.scrollWidth - part.clientWidth;
          const y = part.scrollHeight - part.clientHeight;
          if (part.clientWidth > 0 && hides(style.overflowX) && x > tolerance)
            reasons.push(`content ${x}px wider than its box (${part.tagName.toLowerCase()})`);
          if (part.clientHeight > 0 && hides(style.overflowY) && y > tolerance)
            reasons.push(`content ${y}px taller than its box (${part.tagName.toLowerCase()})`);
        }
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (!(node as Text).data.trim() || !node.parentElement || hidden(node.parentElement))
            continue;
          const range = document.createRange();
          range.selectNodeContents(node);
          for (const rect of Array.from(range.getClientRects())) {
            if (rect.width === 0) continue;
            const out = Math.max(
              box.left - rect.left,
              rect.right - box.right,
              box.top - rect.top,
              rect.bottom - box.bottom,
            );
            // Glyph boxes may pass a tight line box by a pixel. That is not a cut.
            if (out > textTolerance) {
              reasons.push(`text ${out.toFixed(1)}px outside the button`);
              break;
            }
          }
        }
        // A scroll container brings the button into view, so from there on its own box counts.
        let target = { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
        const scrolls = (value: string) => value === 'auto' || value === 'scroll';
        for (let parent = el.parentElement; parent; parent = parent.parentElement) {
          const style = getComputedStyle(parent);
          const p = parent.getBoundingClientRect();
          const left = p.left + parent.clientLeft;
          const top = p.top + parent.clientTop;
          const view = {
            left,
            right: left + parent.clientWidth,
            top,
            bottom: top + parent.clientHeight,
          };
          if (scrolls(style.overflowX)) target = { ...target, left: view.left, right: view.right };
          if (scrolls(style.overflowY)) target = { ...target, top: view.top, bottom: view.bottom };
          const cut = Math.max(
            hides(style.overflowX) ? view.left - target.left : 0,
            hides(style.overflowX) ? target.right - view.right : 0,
            hides(style.overflowY) ? view.top - target.top : 0,
            hides(style.overflowY) ? target.bottom - view.bottom : 0,
          );
          if (cut > tolerance) {
            reasons.push(
              `${cut.toFixed(1)}px cut by parent ${parent.tagName.toLowerCase()}.${String(parent.className).split(' ')[0]}`,
            );
            break;
          }
        }
        if (reasons.length === 0) continue;
        const id = `${run}-c${count++}`;
        el.setAttribute('data-gilt-check', id);
        problems.push({
          id,
          visibleText: (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim(),
          box: { x: box.x, y: box.y, width: box.width, height: box.height },
          reasons,
        });
      }
      return problems;
    },
    { scope: options.scope, selector: options.selector ?? BUTTON_SELECTOR },
  );
  return describe(page, raw);
}

/**
 * Finds buttons whose touch area is smaller than `MIN_TARGET` × `MIN_TARGET`.
 * The check taps nine points of a square around the button's centre with `elementFromPoint`.
 * Every point must reach the button itself (its box or its `::after` touch layer).
 * A point that reaches a neighbour fails too. Points outside the screen are skipped.
 * Disabled buttons and buttons inside another button are skipped.
 */
export async function findSmallTargets(
  page: Page,
  options: CheckOptions & { min?: number } = {},
): Promise<ButtonProblem[]> {
  const raw = await page.evaluate(
    ({ scope, selector, min }) => {
      const root = scope ? document.querySelector(scope) : document.body;
      if (!root) throw new Error(`Scope not found: ${scope}`);
      const problems: RawProblem[] = [];
      const run = String(Date.now() % 1e6);
      let count = 0;
      const label = (node: Element | null) =>
        node
          ? `${node.tagName.toLowerCase()}${node.className && typeof node.className === 'string' ? `.${node.className.trim().split(/\s+/)[0]}` : ''}`
          : 'nothing';
      for (const el of Array.from(root.querySelectorAll<HTMLElement>(selector))) {
        if (el.matches(':disabled, [aria-disabled="true"]')) continue;
        if (el.parentElement?.closest(selector)) continue;
        if (el.getBoundingClientRect().width === 0) continue;
        if (!el.checkVisibility({ visibilityProperty: true, opacityProperty: true })) continue;
        el.scrollIntoView({ block: 'center', inline: 'center' });
        const box = el.getBoundingClientRect();
        const cx = box.left + box.width / 2;
        const cy = box.top + box.height / 2;
        const offset = min / 2 - 0.25;
        const misses: string[] = [];
        for (const dx of [-offset, 0, offset]) {
          for (const dy of [-offset, 0, offset]) {
            const x = cx + dx;
            const y = cy + dy;
            if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) continue;
            const hit = document.elementFromPoint(x, y);
            if (!hit || (hit !== el && !el.contains(hit))) {
              misses.push(`(${dx.toFixed(1)}, ${dy.toFixed(1)}) reaches ${label(hit)}`);
            }
          }
        }
        if (misses.length === 0) continue;
        const id = `${run}-t${count++}`;
        el.setAttribute('data-gilt-check', id);
        problems.push({
          id,
          visibleText: (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim(),
          box: { x: box.x, y: box.y, width: box.width, height: box.height },
          reasons: [`touch area below ${min} × ${min} CSS px`, ...misses],
        });
      }
      window.scrollTo(0, 0);
      return problems;
    },
    {
      scope: options.scope,
      selector: options.selector ?? BUTTON_SELECTOR,
      min: options.min ?? MIN_TARGET,
    },
  );
  return describe(page, raw);
}

/**
 * Attaches the evidence and fails when there is a problem.
 * Evidence: visible text, accessible name, size, reasons and a screenshot of each button.
 * The error names the test and every failing button.
 */
export async function expectNoProblems(
  page: Page,
  testInfo: TestInfo,
  check: 'clipping' | 'touch',
  problems: ButtonProblem[],
): Promise<void> {
  await testInfo.attach(`gilt-${check}`, {
    body: JSON.stringify({ test: testInfo.title, check, problems }, null, 2),
    contentType: 'application/json',
  });
  for (const problem of problems) {
    const shot = await page
      .locator(`[data-gilt-check="${problem.id}"]`)
      .screenshot({ timeout: 5_000 })
      .catch(() => undefined);
    if (shot) {
      await testInfo.attach(`gilt-${check}-${problem.accessibleName || problem.id}`, {
        body: shot,
        contentType: 'image/png',
      });
    }
  }
  if (problems.length === 0) return;
  const lines = problems.map(
    (p) =>
      `- "${p.accessibleName}" (visible text "${p.visibleText}", ${Math.round(p.box.width)} × ${Math.round(p.box.height)} px): ${p.reasons.join('; ')}`,
  );
  throw new Error(
    `${testInfo.title}: ${check} check failed for ${problems.length} button(s)\n${lines.join('\n')}`,
  );
}
