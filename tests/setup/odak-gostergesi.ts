/**
 * Focus indicator checks. Shared by browser tests.
 * Rule: a surrounding focus ring is forbidden. The indicator is a single line on the bottom edge.
 */

/** Splits the computed box-shadow list into parts. */
export function splitShadows(value: string): string[] {
  if (!value || value === 'none') return [];
  return value.split(/,(?![^(]*\))/).map((s) => s.trim());
}

/** The px values of a shadow part other than colour: x, y, blur, spread. */
function shadowLengths(shadow: string): number[] {
  const nums = shadow.replace(/rgba?\([^)]*\)/, '').match(/-?\d+(?:\.\d+)?px/g) ?? [];
  return nums.map((n) => parseFloat(n));
}

/** Single-edge indicator: inset shadow, x 0, y negative, blur 0, spread 0, the given colour. */
export function isBottomBarOnly(shadow: string, color: string): boolean {
  if (!shadow.includes(color) || !shadow.includes('inset')) return false;
  const [x, y, blur, spread] = shadowLengths(shadow);
  return x === 0 && (y ?? 0) < 0 && (blur ?? 0) === 0 && (spread ?? 0) === 0;
}

/**
 * Is the shadow part a surrounding ring? A part with spread above zero, or with blur while both
 * x and y are zero, wraps all four edges of the element. Example: `0 0 0 2px` and `0 0 4px`.
 */
export function isRingShadow(shadow: string): boolean {
  const [x = 0, y = 0, blur = 0, spread = 0] = shadowLengths(shadow);
  return spread > 0 || (x === 0 && y === 0 && blur > 0);
}

/** Minimal page interface for `page.evaluate`; adds no dependency on the Playwright type. */
interface EvaluatingPage {
  evaluate<R, A>(fn: (arg: A) => R, arg: A): Promise<R>;
}

/**
 * Returns the computed value of a CSS colour token on the page as `rgb(...)`.
 * Tests do not hard-code colours; they read them from the token. Example: `await tokenColor(page, '--focus-indicator-color')`.
 * The value depends on the current theme (`html[data-theme]`).
 */
export function tokenColor(page: EvaluatingPage, name: string): Promise<string> {
  return page.evaluate((token: string) => {
    // If the token is not on the page yet, do not silently return black: the test fails with a clear error.
    if (!getComputedStyle(document.documentElement).getPropertyValue(token).trim()) {
      throw new Error(`CSS tokenı sayfada yok: ${token}`);
    }
    const probe = document.createElement('span');
    probe.style.color = `var(${token})`;
    document.body.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }, name);
}
