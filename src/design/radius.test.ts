import { describe, expect, it, vi } from 'vitest';

import { innerRadius, isValidRadius, leafRadius, outerRadius } from './radius';

describe('radius geometry from section 7.2', () => {
  it('uses the corner-adjacent child and clamps the gap to 16', () => {
    expect(outerRadius([{ r: 5, dx: 24, dy: 24 }])).toBe(21);
    expect(
      outerRadius([
        { r: 5, dx: 4, dy: 12 },
        { r: 13, dx: 8, dy: 16 },
      ]),
    ).toBe(21);
    expect(outerRadius([{ r: 5, dx: 0, dy: 16 }])).toBe(5);
  });
  it('caps the shell and the capsule without rounding to a step', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(outerRadius([{ r: 21, dx: 16, dy: 16 }])).toBe(29);
    expect(warning).toHaveBeenCalledOnce();
    expect(outerRadius([{ r: 5, dx: 16, dy: 16 }], { w: 30, h: 20 })).toBe(10);
  });
  it('preserves flush corners, floor and the explicit sharp exception', () => {
    expect(innerRadius(21, 0)).toBe(21);
    expect(innerRadius(21, 16)).toBe(5);
    expect(innerRadius(5, 1)).toBe(4);
    expect(innerRadius(5, 4)).toBe(2);
    expect(innerRadius(5, 8)).toBe(2);
    expect(innerRadius(5, 8, true)).toBe(0);
  });
  it('distinguishes computed leaves from authored radius steps', () => {
    expect(leafRadius(24)).toBe(5);
    expect(leafRadius(20)).toBe(3);
    expect(leafRadius(1)).toBe(2);
    expect(isValidRadius(21)).toBe(true);
    expect(isValidRadius(10)).toBe(false);
    expect(isValidRadius(12)).toBe(false);
  });
});
