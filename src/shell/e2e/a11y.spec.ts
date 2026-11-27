import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '../../../tests/setup/playwright-fixtures';

/** A list the mock server knows: the table is really drawn. `/satis/teklif` opens the error screen. */
const LIST = `/ornek/${encodeURIComponent('örnek-kayıt')}`;

/** A record the mock server knows: axe checks the record form. */
const RECORD = `${LIST}/ORNEK-0003`;

for (const url of ['/', '/satis/teklif', LIST, '/satis/teklif/TEK-0003', RECORD]) {
  test(`axe: ${url}`, async ({ page }, testInfo) => {
    await page.goto(url);
    await expect(page.locator('.shell')).toBeVisible();
    // At the record URL, axe checks the record form. It is measured once the form arrives from the mock server.
    if (url === RECORD) {
      await expect(page.getByRole('textbox', { name: /Örnek başlık/ })).toHaveValue('Örnek veri 3');
    }
    await page.waitForTimeout(400);
    // If the opening colour transitions have not finished, axe measures blended colours and reports contrast.
    // Under load (WebKit desktop) 400 ms was not enough. The test waits for all animations to finish.
    await page.evaluate(async () => {
      // An infinitely looping animation's `finished` promise never settles. Only finite animations are awaited.
      await Promise.all(
        document
          .getAnimations()
          .filter((animation) => Number.isFinite(animation.effect?.getComputedTiming().endTime))
          .map((animation) => animation.finished.catch(() => undefined)),
      );
    });
    // The dark primary button fix (`b339770`) is on this branch. The exclusion was removed; buttons are checked too.
    const r = await new AxeBuilder({ page }).include('.shell').analyze();
    // Moderate and minor violations do not fail the test. They are written to the report as notes.
    for (const v of r.violations.filter((x) => x.impact === 'moderate' || x.impact === 'minor')) {
      testInfo.annotations.push({
        type: `axe-${v.impact ?? 'bilinmiyor'}`,
        description: `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
      });
    }
    const serious = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(
      serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
    ).toEqual([]);
  });
}
