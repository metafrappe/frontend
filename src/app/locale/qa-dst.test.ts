import { describe, expect, it } from 'vitest';
import { createFormatter } from './format';

describe('QA test 6: daylight saving night shows the same instant on screen', () => {
  const format = createFormatter({ language: 'en', timeZone: 'Europe/London' });
  const first = '2026-10-25T01:30:00+01:00';
  const second = '2026-10-25T01:30:00+00:00';

  it('the screen keeps the two instants apart', () => {
    expect(format.frappeDateTime(first)).not.toEqual(format.frappeDateTime(second));
  });
});
