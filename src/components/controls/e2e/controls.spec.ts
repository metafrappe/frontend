import { expect, test } from '../../../../tests/setup/playwright-fixtures';
import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';
import designSource from '../../../../design/source/control-size-config.json' with { type: 'json' };

// Ortak deneme yolu (AGENTS.md, src/shell/routes.ts). Yalnız e2e derlemesinde açılır.
const demo = '/_demo/controls';

async function box(locator: Locator) {
  const bounds = await locator.boundingBox();
  if (!bounds) throw new Error('Expected an element with a visible layout box');
  return bounds;
}

/** Reads a CSS custom property from the root element (the central tokens). */
async function token(page: Page, name: string) {
  return page.evaluate(
    (property) => getComputedStyle(document.documentElement).getPropertyValue(property).trim(),
    name,
  );
}

/**
 * The area a pointer can hit: the element box joined with its `::after` hit layer.
 * The hit-area engine draws that layer (`.hit::after`); controls.css may enlarge it.
 */
async function hitBox(locator: Locator) {
  return locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const after = getComputedStyle(element, '::after');
    let { top, right, bottom, left } = rect;
    if (after.content !== 'none' && after.position === 'absolute') {
      const own = getComputedStyle(element);
      const edge = (value: string) => parseFloat(value) || 0;
      top = Math.min(top, rect.top + edge(own.borderTopWidth) + edge(after.top));
      bottom = Math.max(bottom, rect.bottom - edge(own.borderBottomWidth) - edge(after.bottom));
      left = Math.min(left, rect.left + edge(own.borderLeftWidth) + edge(after.left));
      right = Math.max(right, rect.right - edge(own.borderRightWidth) - edge(after.right));
    }
    return { width: right - left, height: bottom - top };
  });
}

/** Splits a computed `box-shadow` into layers of numbers: x, y, blur, spread. */
function shadowLayers(value: string) {
  if (value === 'none') return [];
  return value.split(/,(?![^()]*\))/).map((layer) => {
    const inset = /\binset\b/.test(layer);
    const lengths =
      layer
        .replace(/rgba?\([^)]*\)|color\([^)]*\)/g, '')
        .match(/-?\d*\.?\d+px/g)
        ?.map((length) => parseFloat(length)) ?? [];
    const [x = 0, y = 0, blur = 0, spread = 0] = lengths;
    return { inset, x, y, blur, spread };
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto(demo);
  await expect(page.getByRole('button', { name: 'İşlemler' })).toBeVisible();
});

const standardEasing = 'cubic-bezier(0.65, 0, 0.35, 1)';
// Foundation decision 5: the shared fast, mid and slow durations (src/design/motion.ts).
const sharedDurations = [100, 200, 300];
/**
 * WebKit can reverse a transition that has almost finished. It then reports a duration
 * such as 199.996 ms (CSS Transitions 1, reversing). Within 1 ms the run counts as the shared
 * duration. A clearly shortened run, for example 150 ms, still fails (review e5-1, K-2).
 */
const DURATION_TOLERANCE_MS = 1;
function asSharedDuration(ms: number): number {
  return sharedDurations.find((shared) => Math.abs(shared - ms) <= DURATION_TOLERANCE_MS) ?? ms;
}

/** Turns on keyboard focus mode with a real Tab press, then focuses the target. */
async function keyboardFocus(page: Page, target: Locator) {
  await page.getByRole('button', { name: 'İşlemler' }).focus();
  await page.keyboard.press('Tab');
  await target.focus();
}

interface Run {
  property: string;
  duration: number;
  easing: string;
}

interface Recording {
  runs: Run[];
  /** Transitions that began (`transitionrun`) and have not ended or been cancelled yet. */
  open: Set<string>;
}

/**
 * Starts recording every CSS transition that begins inside `scope`.
 * Each run is read at its `transitionrun` event. The running animation gives the timing.
 * On a slow frame the browser can deliver `transitionrun` and `transitionend` together, after
 * the animation has already finished and left `getAnimations()`. Then the timing comes from the
 * computed transition style that started it. So the measurement does not depend on one frame.
 * `transitionend` and `transitioncancel` close each run. `settled()` is true when every run closed.
 */
async function recordTransitions(scope: Locator) {
  await scope.evaluate((element) => {
    const recording: Recording = { runs: [], open: new Set() };
    (window as unknown as { __recording: Recording }).__recording = recording;
    const keys = new WeakMap<EventTarget, number>();
    let next = 0;
    const keyOf = (event: TransitionEvent) => {
      const target = event.target as EventTarget;
      if (!keys.has(target)) keys.set(target, (next += 1));
      return `${keys.get(target)} ${event.pseudoElement} ${event.propertyName}`;
    };
    // Computed lists repeat when they are shorter than transition-property (CSS Transitions 1).
    const declared = (target: Element, pseudo: string, property: string) => {
      const style = getComputedStyle(target, pseudo || null);
      const properties = style.transitionProperty.split(/,\s*/);
      const durations = style.transitionDuration.split(/,\s*/);
      const easings = style.transitionTimingFunction.split(/,\s*(?![^()]*\))/);
      let index = properties.indexOf(property);
      if (index < 0) index = properties.lastIndexOf('all');
      if (index < 0) return null;
      return {
        duration: parseFloat(durations[index % durations.length] ?? '0') * 1000,
        easing: easings[index % easings.length] ?? '',
      };
    };
    element.addEventListener('transitionrun', (raw) => {
      const event = raw as TransitionEvent;
      const target = event.target;
      if (!(target instanceof Element)) return;
      recording.open.add(keyOf(event));
      const property = `${target.className} ${event.pseudoElement} ${event.propertyName}`;
      for (const animation of target.getAnimations({ subtree: true })) {
        if (!(animation instanceof CSSTransition)) continue;
        if (animation.transitionProperty !== event.propertyName) continue;
        const effect = animation.effect as KeyframeEffect | null;
        if (effect?.target !== target || (effect.pseudoElement ?? '') !== event.pseudoElement) {
          continue;
        }
        const timing = effect.getComputedTiming();
        recording.runs.push({
          property,
          duration: Number(timing.duration ?? 0),
          easing: timing.easing ?? '',
        });
        return;
      }
      const style = declared(target, event.pseudoElement, event.propertyName);
      if (style) recording.runs.push({ property: `${property} (style)`, ...style });
    });
    for (const type of ['transitionend', 'transitioncancel']) {
      element.addEventListener(type, (raw) => {
        recording.open.delete(keyOf(raw as TransitionEvent));
      });
    }
  });
  // Page functions are sent as source text. Each one reads the recording from `window`.
  const page = scope.page();
  interface Store {
    __recording: Recording;
  }
  return {
    count: () => page.evaluate(() => (window as unknown as Store).__recording.runs.length),
    settled: () => page.evaluate(() => (window as unknown as Store).__recording.open.size === 0),
    take: () => page.evaluate(() => (window as unknown as Store).__recording.runs.splice(0)),
  };
}

/** Reads the CSS transitions that are still running inside `target`. */
async function transitions(target: Locator) {
  return target
    .evaluate((element) =>
      element
        .getAnimations({ subtree: true })
        .filter((animation) => animation instanceof CSSTransition),
    )
    .then((list) => list.length);
}

test('controls match the locked height and font size', async ({ page, hasTouch }) => {
  // On a touch screen (any-pointer: coarse) every control grows to the touch target token.
  const touch = hasTouch ? parseFloat(await token(page, '--hit-target')) : 0;
  expect(hasTouch ? touch : 48).toBe(48);
  for (const [size, height, fontSize] of [
    ['small', 36, 14],
    ['middle', 42, 16],
    ['large', 48, 18],
  ] as const) {
    const row = page.getByTestId(`row-${size}`);
    for (const [surface, text] of [
      ['.ant-btn', '.ant-btn'],
      ['.ant-input-affix-wrapper', '.ant-input'],
      ['.ant-select-selector', '.ant-select-selection-item'],
      ['.ant-input-number', '.ant-input-number-input'],
    ] as const) {
      await expect(row.locator(surface), `${size} ${surface}`).toHaveCSS(
        'height',
        `${Math.max(height, touch)}px`,
      );
      await expect(row.locator(text), `${size} ${text}`).toHaveCSS('font-size', `${fontSize}px`);
    }
    await expect(page.getByTestId(`link-${size}`)).toHaveCSS('font-size', `${fontSize}px`);
  }

  await expect(page.getByTestId('card')).toHaveCSS('border-radius', '21px');
});

test('choice controls match the locked height and font size', async ({ page, hasTouch }) => {
  // Source: control-size-config.json choice.C3 and the per-control antdTheme blocks.
  // Values are read from the source file: the smallest text is 14 px (AJA-997).
  // The tab labels are 14 px and each tab item is 28 px (AJA-998, draft `.seg`).
  // On touch the rows grow to 48 px.
  const c = designSource.choice;
  const touch = hasTouch ? 48 : 0;
  for (const [control, height, fontSize, grows] of [
    ['.ant-checkbox-wrapper', c.checkbox.height, c.checkbox.labelSize, true],
    ['.ant-radio-button-wrapper', c.radio.height, c.radio.labelSize, true],
    ['.atonota-switch', c.switch.height, c.switch.labelSize, true],
    ['.ant-switch', c.switch.trackHeight, c.switch.antdTheme.token.fontSize, false],
    ['.ant-segmented-item', 28, 14, true],
    ['.ant-tag', c.tag.height, c.tag.fontSize, false],
  ] as const) {
    expect(fontSize, `${control} text`).toBeGreaterThanOrEqual(14);
    const target = page.locator('.controls-demo').locator(control).first();
    const expected = grows ? Math.max(height, touch) : height;
    await expect.soft(target, control).toHaveCSS('height', `${expected}px`, { timeout: 1000 });
    await expect.soft(target, control).toHaveCSS('font-size', `${fontSize}px`, { timeout: 1000 });
  }
  await expect(page.locator('.controls-demo-row').first().locator('.ant-checkbox-inner')).toHaveCSS(
    'width',
    '20px',
  );
  for (const control of ['.ant-checkbox-wrapper', '.ant-radio-button-wrapper', '.ant-switch']) {
    await expect(page.locator('.controls-demo').locator(control).first(), control).toHaveClass(
      /\bhit\b/,
    );
  }
});

for (const style of ['İşlemler', 'shortcut', 'described', 'selectable', 'searchable']) {
  test(`${style} menu handles arrows, Space, Enter and Escape`, async ({ page }) => {
    const trigger = page.getByRole('button', { name: style, exact: true });
    await trigger.focus();
    await page.keyboard.press('Space');

    const menu = page.getByRole('menu');
    const role = style === 'selectable' ? 'menuitemradio' : 'menuitem';
    const edit = menu.getByRole(role, { name: /^Düzenle/ });
    const copy = menu.getByRole(role, { name: /^Kopyala/ });
    if (style === 'selectable') {
      await expect(edit).toHaveAttribute('aria-checked', 'false');
      await expect(copy).toHaveAttribute('aria-checked', 'true');
    }
    if (style === 'searchable') {
      await expect(page.getByRole('textbox', { name: 'Menüde ara' })).toBeFocused();
      await page.keyboard.press('ArrowDown');
    }
    await expect(edit).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(copy).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(edit).toBeFocused();
    await page.keyboard.press('Space');
    await expect(page.getByTestId('action')).toHaveText('edit');
    await expect(trigger).toBeFocused();

    await page.keyboard.press('Enter');
    if (style === 'searchable') {
      await page.getByRole('textbox', { name: 'Menüde ara' }).fill('KOPYALA');
      await expect(edit).toHaveCount(0);
      await page.keyboard.press('ArrowDown');
    } else {
      await expect(edit).toBeFocused();
      await page.keyboard.press('ArrowDown');
    }
    await expect(copy).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('action')).toHaveText('copy');
    // The same Enter must not reach the refocused trigger and open the menu again.
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await page.keyboard.press('Enter');
    await expect(menu).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();
  });
}

test('Tab enables a single focus indicator and pointer input turns it off', async ({
  page,
  browserName,
}) => {
  const trigger = page.getByRole('button', { name: 'İşlemler' });
  const next = page.getByRole('button', { name: 'shortcut' });
  await trigger.focus();
  if (browserName === 'webkit') {
    await page.keyboard.press('Tab');
    await trigger.focus();
  }
  await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
  await expect(next).toBeFocused();
  await expect(next).toHaveCSS('outline-style', 'none');
  const indicator = () => next.evaluate((element) => getComputedStyle(element, '::before').content);
  expect(await indicator()).toBe('""');
  await page.keyboard.press(browserName === 'webkit' ? 'Alt+Shift+Tab' : 'Shift+Tab');
  await expect(trigger).toBeFocused();
  await next.click();
  await expect(next).toHaveCSS('outline-style', 'none');
  expect(await indicator()).toBe('none');
});

test('dropdown animation uses the shared motion and honors reduced motion', async ({ page }) => {
  const trigger = page.getByRole('button', { name: 'İşlemler' });
  const popup = page.locator('.atonota-dropdown-popup');
  // The dropdown motion is short (source dropdown.animation, 140 ms). Polling the computed style can
  // miss it, so the test records the style when each animation starts.
  await page.evaluate(() => {
    const seen: Record<string, string> = {};
    (window as unknown as { __dropdownMotion: Record<string, string> }).__dropdownMotion = seen;
    document.addEventListener('animationstart', (event) => {
      if (!event.animationName.startsWith('atonota-dropdown-')) return;
      const style = getComputedStyle(event.target as Element);
      seen[event.animationName] = `${style.animationDuration} ${style.animationTimingFunction}`;
    });
  });
  const motion = (name: string) =>
    page.evaluate(
      (key) =>
        (window as unknown as { __dropdownMotion: Record<string, string> }).__dropdownMotion[key],
      name,
    );
  const expected = `${designSource.dropdown.animation.duration / 1000}s ${standardEasing}`;
  await trigger.click();
  await expect(popup).toBeVisible();
  await expect.poll(() => motion('atonota-dropdown-in')).toBe(expected);
  await page.keyboard.press('Escape');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect.poll(() => motion('atonota-dropdown-out')).toBe(expected);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await trigger.click();
  await expect(popup).toHaveCSS('animation-name', 'none');
});

test('open menu with long text stays inside the viewport', async ({ page }) => {
  // The opening motion is short (140 ms) and can finish between two computed-style polls, so the
  // test records the animation when it starts and measures only after it has ended.
  await page.evaluate(() => {
    const started: string[] = [];
    (window as unknown as { __dropdownStarted: string[] }).__dropdownStarted = started;
    document.addEventListener('animationstart', (event) => {
      if (event.animationName.startsWith('atonota-dropdown-')) started.push(event.animationName);
    });
  });
  await page.getByRole('button', { name: 'İşlemler' }).click();
  const item = page.getByRole('menuitem', { name: /Bu kaydın daha önce/ });
  await expect(item).toBeVisible();
  const popup = page.locator('.atonota-dropdown-popup');
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { __dropdownStarted: string[] }).__dropdownStarted),
    )
    .toContain('atonota-dropdown-in');
  await expect(popup).toHaveCSS('animation-name', 'none');
  const bounds = await box(item);
  const popupBounds = await box(popup);
  const width = await page.evaluate(() => window.innerWidth);
  for (const area of [popupBounds, bounds]) {
    expect(area.x).toBeGreaterThanOrEqual(0);
    expect(area.x + area.width).toBeLessThanOrEqual(width);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    width,
  );
});

test('select joins its popup and only the popup has a shadow', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const row = page.getByTestId('row-small');
  const selector = row.locator('.ant-select-selector');
  await selector.click();
  const popup = page.locator('.atonota-select-popup');
  await expect(popup).toBeVisible();
  const above = (await popup.getAttribute('class'))?.includes('placement-top');
  await expect(selector).toHaveCSS(
    above ? 'border-top-left-radius' : 'border-bottom-left-radius',
    '0px',
  );
  const selectorBounds = await box(selector);
  const popupBounds = await box(popup);
  const gap = above
    ? selectorBounds.y - popupBounds.y - popupBounds.height
    : popupBounds.y - selectorBounds.y - selectorBounds.height;
  expect(Math.abs(gap)).toBeLessThanOrEqual(1);
  for (const surface of [
    selector,
    row.locator('.ant-input-affix-wrapper'),
    row.locator('.ant-input-number'),
  ]) {
    await expect(surface).toHaveCSS('box-shadow', 'none');
  }
  await expect(popup).not.toHaveCSS('box-shadow', 'none');
  await popup.getByText('Kapalı', { exact: true }).click();
  await expect(selector).toHaveText('Kapalı');
  await expect(popup).toBeHidden();
});

test('split actions stay separate and use the shared hit-area engine', async ({
  page,
  hasTouch,
}) => {
  const primary = page.getByRole('button', { name: 'Dışa aktar', exact: true });
  const trigger = page.getByRole('button', { name: 'Dışa aktarma seçenekleri' });
  await expect(primary).toHaveClass(/\bhit\b/);
  const extension = await primary.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      desiredHeight: rect.height * 0.06,
      top: parseFloat(style.getPropertyValue('--hit-t')) - parseFloat(style.borderTopWidth),
      right: parseFloat(style.getPropertyValue('--hit-r')) - parseFloat(style.borderRightWidth),
    };
  });
  expect(extension.top).toBeCloseTo(extension.desiredHeight, 1);
  expect(extension.right).toBeCloseTo(0, 1);
  await expect(page.locator('.ant-input-affix-wrapper').first()).toHaveClass(/\bhit\b/);
  await expect(page.locator('.atonota-number').first()).toHaveClass(/\bhit\b/);
  await expect(page.getByTestId('link-small')).toHaveClass(/\bhit\b/);
  const bounds = await box(primary);
  const pointer = hasTouch ? page.touchscreen : page.mouse;
  if ('tap' in pointer) await pointer.tap(bounds.x + bounds.width / 2, bounds.y - 1);
  else await pointer.click(bounds.x + bounds.width / 2, bounds.y - 1);
  await expect(page.getByTestId('action')).toHaveText('export');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await trigger.click();
  await page.getByRole('menuitem', { name: 'Düzenle' }).click();
  await expect(page.getByTestId('action')).toHaveText('edit');
});

for (const scheme of ['light', 'dark'] as const) {
  test(`controls have no shadow outside the popup in ${scheme} mode`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
    const demo = page.locator('.controls-demo');
    for (const control of [
      '.atonota-button',
      '.ant-input-affix-wrapper',
      '.ant-select-selector',
      '.ant-input-number',
      '.ant-checkbox-wrapper',
      '.ant-radio-wrapper',
      '.ant-radio-button-wrapper',
      '.ant-switch',
      '.ant-segmented',
      '.ant-segmented-item-selected',
      '.ant-tag',
      '.atonota-card',
    ]) {
      const target = demo.locator(control).first();
      await expect.soft(target, control).toHaveCSS('box-shadow', 'none', { timeout: 1000 });
    }
  });
}

test('keyboard focus shows one indicator that does not surround the control', async ({ page }) => {
  const row = page.getByTestId('row-middle');
  const cases: [string, Locator, Locator][] = [
    ['button', row.locator('.atonota-button'), row.locator('.atonota-button')],
    ['input', row.locator('.ant-input'), row.locator('.ant-input-affix-wrapper')],
    ['select', row.getByRole('combobox'), row.locator('.ant-select-selector')],
    ['number', row.locator('.ant-input-number-input'), row.locator('.ant-input-number')],
    [
      'checkbox',
      page.getByRole('checkbox', { name: 'Seç' }),
      page.locator('.ant-checkbox-wrapper', { hasText: 'Seç' }),
    ],
    ['switch', page.getByRole('switch', { name: 'Etkin' }), page.getByRole('switch')],
    [
      'tabs',
      page.getByTestId('tabs').locator('input').first(),
      page.getByTestId('tabs').locator('.ant-segmented-item').first(),
    ],
  ];
  for (const [name, input, surface] of cases) {
    await keyboardFocus(page, input);
    await expect(input, name).toBeFocused();
    // A ring would be an outline or a shadow on every side. Neither is allowed.
    for (const element of [input, surface]) {
      await expect(element, name).toHaveCSS('outline-style', 'none');
      const rings = async () =>
        shadowLayers(await element.evaluate((node) => getComputedStyle(node).boxShadow)).filter(
          (layer) => layer.spread > 0 || layer.blur !== 0 || layer.x !== 0 || layer.y > 0,
        ).length;
      await expect.poll(rings, { message: `${name} ring` }).toBe(0);
    }
    // The single indicator: an underline shadow on the surface or a bottom bar (`::before`).
    // antd surfaces animate their shadow, so the count is read until the transition ends.
    const indicators = async () => {
      const indicator = await surface.evaluate((node) => {
        const shadow = getComputedStyle(node).boxShadow;
        const before = getComputedStyle(node, '::before');
        return { shadow, bar: before.content !== 'none' && before.backgroundColor };
      });
      const underline = shadowLayers(indicator.shadow).filter((layer) => layer.y < 0);
      const bars = indicator.bar && indicator.bar !== 'rgba(0, 0, 0, 0)' ? 1 : 0;
      return underline.length + bars;
    };
    await expect.poll(indicators, { message: `${name} indicator` }).toBe(1);
    // An underline shadow touches the bottom corners, so they lose their radius (no curved edge).
    const corners = () =>
      surface.evaluate((node) => {
        const style = getComputedStyle(node);
        if (style.boxShadow === 'none') return 'no underline shadow';
        return `${style.borderBottomLeftRadius} ${style.borderBottomRightRadius}`;
      });
    await expect.poll(corners, { message: `${name} corner` }).toMatch(/^(0px 0px|no underline)/);
  }
});

test('touch targets are at least 48 px on a touch screen', async ({ page, hasTouch }) => {
  test.skip(!hasTouch, 'Only touch profiles use the coarse touch target');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const demo = page.locator('.controls-demo');
  const targets = demo.locator(
    [
      '.atonota-button',
      '.ant-input-affix-wrapper',
      '.ant-input-number',
      '.ant-select-selector',
      'a.atonota-link',
      '.ant-checkbox-wrapper',
      '.ant-radio-wrapper',
      '.ant-radio-button-wrapper',
      '.ant-switch',
      '.ant-segmented-item',
    ].join(', '),
  );
  const count = await targets.count();
  expect(count).toBeGreaterThan(20);
  for (let index = 0; index < count; index += 1) {
    const target = targets.nth(index);
    const label = await target.evaluate((node) => `${node.className} ${node.textContent ?? ''}`);
    const area = await hitBox(target);
    expect.soft(area.height, label).toBeGreaterThanOrEqual(48);
    expect.soft(area.width, label).toBeGreaterThanOrEqual(48);
  }
});

test.describe('select input methods', () => {
  // Set the preference before beforeEach navigates. A late media change rebuilds antd's
  // motion wrappers and can replace the focused Select while its popup is opening.
  test.use({ reducedMotion: 'reduce' });

  test('select is the branded antd select and works with keyboard, pointer and touch', async ({
    page,
    hasTouch,
  }) => {
    await expect(page.locator('select')).toHaveCount(0);
    const row = page.getByTestId('row-middle');
    const combobox = row.getByRole('combobox');
    const selector = row.locator('.ant-select-selector');
    const popup = page.locator('.atonota-select-popup:not(.ant-select-dropdown-hidden)');

    await keyboardFocus(page, combobox);
    await page.keyboard.press('ArrowDown');
    await expect(popup).toBeVisible();
    // rc-select restores the selected option while rc-motion prepares the popup. Wait for
    // that opening phase to finish before sending the next key, including in reduced motion.
    await expect(popup).not.toHaveClass(/\batonota-popup-motion-(appear|enter)\b/);
    const active = popup.locator('.ant-select-item-option-active');
    await expect(active).toHaveText('Açık');
    await expect(combobox).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('ArrowDown');
    await expect(active).toHaveText('Kapalı');
    await page.keyboard.press('Enter');
    await expect(combobox).toHaveAttribute('aria-expanded', 'false');
    await expect(popup).toBeHidden();
    await expect(selector).toHaveText('Kapalı');

    await selector.click();
    await expect(popup).toBeVisible();
    await popup.getByText('Açık', { exact: true }).click();
    await expect(selector).toHaveText('Açık');
    await expect(combobox).toHaveAttribute('aria-expanded', 'false');
    await expect(popup).toBeHidden();

    if (hasTouch) {
      await selector.tap();
      await expect(popup).toBeVisible();
      await popup.getByText('Kapalı', { exact: true }).tap();
      await expect(selector).toHaveText('Kapalı');
      await expect(combobox).toHaveAttribute('aria-expanded', 'false');
      await expect(popup).toBeHidden();
    }
  });
});

test('demo page does not overflow horizontally', async ({ page }) => {
  const sizes = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.client);
});

for (const scheme of ['light', 'dark'] as const) {
  test(`axe finds no violations in ${scheme} mode`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
    const result = await new AxeBuilder({ page })
      .include('.controls-demo')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
      .analyze();
    expect(result.violations.map((violation) => violation.id)).toEqual([]);
  });
}

test('forced colors outlines the focused control only in keyboard mode', async ({
  page,
  browserName,
}) => {
  test.skip(browserName === 'webkit', 'Playwright WebKit on macOS does not emulate forced colors');
  await page.emulateMedia({ forcedColors: 'active' });
  const trigger = page.getByRole('button', { name: 'İşlemler' });
  const next = page.getByRole('button', { name: 'shortcut' });
  await trigger.focus();
  await expect(trigger).toHaveCSS('outline-style', 'none');
  await page.keyboard.press('Tab');
  await expect(next).toBeFocused();
  await expect(next).toHaveCSS('outline-style', 'solid');
  await expect(next).toHaveCSS('outline-width', '2px');
  await next.click();
  await expect(next).toHaveCSS('outline-style', 'none');
});

for (const scheme of ['light', 'dark'] as const) {
  test(`danger menu item keeps 4.5:1 contrast on hover in ${scheme} mode`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
    await page.getByRole('button', { name: 'İşlemler' }).click();
    const item = page.getByRole('menuitem', { name: 'Sil' });
    await item.hover();
    const colors = await item.evaluate((element) => {
      const style = getComputedStyle(element);
      return { text: style.color, background: style.backgroundColor };
    });
    const ratio = await page.evaluate(({ text, background }) => {
      const luminance = (value: string) => {
        const [r = 0, g = 0, b = 0] = (value.match(/[\d.]+/g) ?? []).slice(0, 3).map((part) => {
          const channel = Number(part) / 255;
          return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const [high = 0, low = 0] = [luminance(text), luminance(background)].sort((a, b) => b - a);
      return (high + 0.05) / (low + 0.05);
    }, colors);
    expect(colors.text).toBe('rgb(255, 255, 255)');
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
}

test('radio button label shows the keyboard focus underline without a ring', async ({ page }) => {
  const label = page
    .getByTestId('radio-buttons')
    .locator('.ant-radio-button-wrapper', { hasText: 'Birinci' });
  const input = label.locator('input');
  await keyboardFocus(page, input);
  await expect(input).toBeFocused();
  await expect(label).toHaveCSS('box-shadow', /inset/);
  await expect(label).toHaveCSS('box-shadow', /0px -2px 0px 0px/);
  await expect(label).toHaveCSS('outline-style', 'none');
  await label.click();
  await expect(label).not.toHaveCSS('box-shadow', /0px -2px 0px 0px/);
});

test('radio uses the 32 px card style from the source decision', async ({ page, hasTouch }) => {
  const group = page.getByTestId('radio-cards');
  const week = group.locator('.ant-radio-wrapper', { hasText: 'Haftalık' });
  const month = group.locator('.ant-radio-wrapper', { hasText: 'Aylık' });
  await expect(week).toHaveCSS('height', hasTouch ? '48px' : '32px');
  await expect(week).toHaveCSS('border-top-style', 'solid');
  await expect(week).toHaveCSS('border-top-width', '1px');
  await expect(week).toHaveCSS('border-radius', '5px');
  const primary = await week.evaluate((element) =>
    getComputedStyle(element).getPropertyValue('--ant-color-primary').trim(),
  );
  expect(primary).not.toBe('');
  const rgb = await page.evaluate((color) => {
    const probe = document.createElement('i');
    probe.style.color = color;
    document.body.append(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  }, primary);
  await expect(week).toHaveCSS('border-top-color', rgb);
  await expect(month).not.toHaveCSS('border-top-color', rgb);
  await expect(week).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(month).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await month.click();
  await expect(month).toHaveCSS('border-top-color', rgb);
});

test('switch is squared and shows its state text', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const control = page.getByRole('switch', { name: 'Etkin' });
  await expect(control).toHaveCSS('border-radius', '5px');
  await expect(control.locator('.ant-switch-handle')).toHaveCSS('border-radius', '0px');
  // WebKit can answer an empty pseudo-element style before its first style pass; wait for it.
  await expect
    .poll(() =>
      control
        .locator('.ant-switch-handle')
        .evaluate((element) => getComputedStyle(element, '::before').borderRadius),
    )
    .toBe('3px');
  await expect(control).toHaveAttribute('aria-checked', 'false');
  await expect(control.locator('.ant-switch-inner-unchecked')).toHaveText('Kapalı');
  await expect(control.locator('.ant-switch-inner-unchecked')).toBeVisible();
  await control.click();
  await expect(control).toHaveAttribute('aria-checked', 'true');
  await expect(control.locator('.ant-switch-inner-checked')).toHaveText('Açık');
  await expect(control.locator('.ant-switch-inner-checked')).toBeVisible();
});

for (const scheme of ['light', 'dark'] as const) {
  test(`switch state text keeps 4.5:1 contrast in ${scheme} mode`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
    const control = page.getByRole('switch', { name: 'Etkin' });
    for (const state of ['unchecked', 'checked'] as const) {
      if (state === 'checked') await control.click();
      await expect(control).toHaveAttribute('aria-checked', String(state === 'checked'));
      const text = control.locator(`.ant-switch-inner-${state}`);
      await expect(text).toBeVisible();
      await expect(control).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      for (const interaction of ['rest', 'hover'] as const) {
        if (interaction === 'hover') await control.hover();
        else await page.mouse.move(0, 0);
        const ratio = await control.evaluate((element, which) => {
          const text = element.querySelector(`.ant-switch-inner-${which}`);
          if (!text) return 0;
          const parse = (value: string): number[] => {
            const srgb = value.startsWith('color(srgb ');
            const channels = (
              value.slice(srgb ? 'color(srgb '.length : value.indexOf('(') + 1).match(/[\d.]+/g) ??
              []
            ).map(Number);
            return srgb
              ? channels.map((channel, i) => (i < 3 ? channel * 255 : channel))
              : channels;
          };
          // First opaque background behind the switch; the canvas is white when none is set.
          let page = [255, 255, 255];
          for (let node = element.parentElement; node; node = node.parentElement) {
            const [r = 0, g = 0, b = 0, a = 1] = parse(getComputedStyle(node).backgroundColor);
            if (a === 1) {
              page = [r, g, b];
              break;
            }
          }
          const flatten = (value: string, base: number[]) => {
            const [r = 0, g = 0, b = 0, a = 1] = parse(value);
            return [r, g, b].map((c, i) => c * a + (base[i] ?? 255) * (1 - a));
          };
          const track = flatten(getComputedStyle(element).backgroundColor, page.slice(0, 3));
          const ink = flatten(getComputedStyle(text).color, track);
          const luminance = (rgb: number[]) => {
            const [r = 0, g = 0, b = 0] = rgb.map((part) => {
              const c = part / 255;
              return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
            });
            return 0.2126 * r + 0.7152 * g + 0.0722 * b;
          };
          const [high = 0, low = 0] = [luminance(ink), luminance(track)].sort((x, y) => y - x);
          return (high + 0.05) / (low + 0.05);
        }, state);
        const colors = await text.evaluate((element) => {
          const track = element.closest('.ant-switch');
          return `${getComputedStyle(element).color} on ${track ? getComputedStyle(track).backgroundColor : ''}`;
        });
        expect(ratio, `${scheme} ${state} ${interaction}: ${colors}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
}

/** Waits until a clicked choice control shows its final, selected state. */
async function settled(target: Locator) {
  const className = await target.evaluate((element) => element.className);
  if (className.includes('ant-segmented-item')) {
    await expect(target).toHaveClass(/\bant-segmented-item-selected\b/);
    await expect(target.locator('xpath=..').locator('.ant-segmented-thumb')).toHaveCount(0);
  } else if (className.includes('ant-radio-button-wrapper')) {
    await expect(target).toHaveClass(/\bant-radio-button-wrapper-checked\b/);
  } else if (className.includes('ant-radio-wrapper')) {
    await expect(target).toHaveClass(/\bant-radio-wrapper-checked\b/);
  }
  // The switch changes aria-checked on click; its transitions all start in that frame.
}

/** The choice controls whose transitions are measured. `back` restores the first state. */
const choiceCases: Record<
  'switch' | 'radio card' | 'radio button' | 'segmented',
  (page: Page) => { root: Locator; back?: Locator }
> = {
  switch: (page) => ({ root: page.getByRole('switch', { name: 'Etkin' }) }),
  'radio card': (page) => ({
    root: page.getByTestId('radio-cards').locator('.ant-radio-wrapper', { hasText: 'Aylık' }),
    back: page.getByTestId('radio-cards').locator('.ant-radio-wrapper', { hasText: 'Haftalık' }),
  }),
  'radio button': (page) => ({
    root: page.getByTestId('radio-buttons').locator('.ant-radio-button-wrapper', {
      hasText: 'İkinci',
    }),
    back: page.getByTestId('radio-buttons').locator('.ant-radio-button-wrapper', {
      hasText: 'Birinci',
    }),
  }),
  segmented: (page) => ({
    root: page.getByTestId('tabs').locator('.ant-segmented-item', { hasText: 'Ay' }),
    back: page.getByTestId('tabs').locator('.ant-segmented-item', { hasText: 'Gün' }),
  }),
};

// Each control has its own test. Linux WebKit can hold a frame for seconds under load.
// Eight clicks in one test would share one time budget (review 1, Ö-1). Expectations are unchanged.
for (const [name, build] of Object.entries(choiceCases)) {
  test(`${name} transitions use the shared easing and duration in both directions`, async ({
    page,
  }) => {
    const { root, back } = build(page);
    for (const [direction, target] of [
      ['forward', root],
      ['back', back ?? root],
    ] as const) {
      const scope = name === 'segmented' ? page.getByTestId('tabs') : root.locator('..');
      const recorder = await recordTransitions(scope);
      const check = (runs: Run[], phase: string) => {
        for (const t of runs) {
          expect(t.easing, `${name} ${direction} ${phase} ${t.property}`).toBe(standardEasing);
          expect(sharedDurations, `${name} ${direction} ${phase} ${t.property}`).toContain(
            asSharedDuration(t.duration),
          );
        }
      };
      const finished = async () => {
        await expect.poll(recorder.settled).toBe(true);
        await expect.poll(() => transitions(scope)).toBe(0);
      };
      // Hover first and let the hover feedback finish. Otherwise, on a slow frame, the item
      // can become selected while its hover layer is still fading in. The browser then reverses
      // that transition with a shortened duration (CSS Transitions 1, reversing). Hover
      // transitions are checked on their own, so they never count as the click's motion (review 2, Ö-2).
      await target.hover();
      await finished();
      check(await recorder.take(), 'hover');
      // Press and release are separate steps. A pressed control has its own motion: antd widens
      // the switch handle under `:active`. With one click, a slow frame lets the release reverse
      // that motion with a shortened duration (review 2, Ö-1). So the press motion ends first.
      await page.mouse.down();
      await finished();
      check(await recorder.take(), 'press');
      await page.mouse.up();
      const noRun = `${name} ${direction}: no transition ran`;
      await expect.poll(recorder.count, noRun).toBeGreaterThan(0);
      // Wait for the end of the whole motion, so the next click is not a shortened reversal.
      // Segmented moves in steps: label color, then the sliding thumb, then the selected item's
      // hover layer. Between the steps no transition runs for a moment. So the wait first checks
      // the final state (thumb gone, item selected), then that every started transition ended.
      await settled(target);
      await finished();
      // Only the release changes the selection. Its runs alone prove that the click animates.
      const running = await recorder.take();
      expect(running.length, noRun).toBeGreaterThan(0);
      check(running, 'release');
    }
  });
}

test('checkbox mark uses the shared transition in both directions', async ({ page }) => {
  const checkbox = page.getByRole('checkbox', { name: 'Seç', exact: true });
  const mark = page.locator('.atonota-checkbox', { has: checkbox }).locator('.ant-checkbox-inner');
  for (const checked of [true, false]) {
    await checkbox.setChecked(checked);
    const transition = await mark.evaluate((element) => {
      const style = getComputedStyle(element, '::after');
      return {
        easings: style.transitionTimingFunction.split(/,\s*(?![^()]*\))/),
        durations: style.transitionDuration.split(', '),
      };
    });
    for (const easing of transition.easings) expect(easing).toBe(standardEasing);
    for (const duration of transition.durations) {
      expect(sharedDurations).toContain(parseFloat(duration) * 1000);
    }
  }
});

test('choice transitions stop when reduced motion is on', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const control = page.getByRole('switch', { name: 'Etkin' });
  for (const target of [
    control,
    page.getByTestId('radio-cards').locator('.ant-radio-wrapper', { hasText: 'Aylık' }),
    page.getByTestId('radio-buttons').locator('.ant-radio-button-wrapper', { hasText: 'İkinci' }),
    page.getByTestId('tabs').locator('.ant-segmented-item', { hasText: 'Ay' }),
  ]) {
    const recorder = await recordTransitions(target.locator('..'));
    await target.click();
    await expect.poll(() => transitions(target.locator('..'))).toBe(0);
    for (const run of await recorder.take()) expect(run.duration, run.property).toBe(0);
  }
  await expect(control.locator('.ant-switch-handle')).toHaveCSS('transition-duration', '0s');
});

test('Tab and Shift+Tab close the menu and move to the next or previous control', async ({
  page,
  browserName,
}) => {
  const first = page.getByRole('button', { name: 'İşlemler', exact: true });
  const second = page.getByRole('button', { name: 'shortcut', exact: true });
  const menu = page.getByRole('menu');

  await first.focus();
  await page.keyboard.press('Enter');
  await expect(menu.getByRole('menuitem', { name: /^Düzenle/ })).toBeFocused();
  // WebKit uses Option+Tab to include buttons in its native tab order.
  await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
  await expect(menu).toBeHidden();
  await expect(second).toBeFocused();
  await expect(first).toHaveAttribute('aria-expanded', 'false');

  await page.keyboard.press('Enter');
  await expect(menu.getByRole('menuitem', { name: /^Düzenle/ })).toBeFocused();
  await page.keyboard.press(browserName === 'webkit' ? 'Alt+Shift+Tab' : 'Shift+Tab');
  await expect(menu).toBeHidden();
  await expect(first).toBeFocused();
  await expect(second).toHaveAttribute('aria-expanded', 'false');
});

test('Tab from the menu follows the native order past a hidden control', async ({
  page,
  browserName,
}) => {
  const first = page.getByRole('button', { name: 'İşlemler', exact: true });
  const second = page.getByRole('button', { name: 'shortcut', exact: true });
  await first.evaluate((trigger) => {
    const hidden = document.createElement('button');
    hidden.style.visibility = 'hidden';
    trigger.after(hidden);
  });

  await first.focus();
  await page.keyboard.press('Enter');
  const item = page.getByRole('menuitem', { name: /^Düzenle/ });
  await expect(item).toBeFocused();
  await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
  await expect(item).toBeHidden();
  await expect(second).toBeFocused();
});

test('unmodified Tab from the popup enables keyboard focus mode', async ({ page }) => {
  const trigger = page.getByRole('button', { name: 'İşlemler', exact: true });
  const html = page.locator('html');
  await trigger.click();
  const item = page.getByRole('menuitem', { name: /^Düzenle/ });
  await expect(item).toBeFocused();
  await expect(html).not.toHaveAttribute('data-focus-mode', 'keyboard');
  await page.keyboard.press('Tab');
  await expect(item).toBeHidden();
  await expect(html).toHaveAttribute('data-focus-mode', 'keyboard');
});
