import { expect, test, type Page } from '../../../../tests/setup/playwright-fixtures';
import {
  MIN_TARGET,
  NARROW_WIDTH,
  applyPseudoLocale,
  expectNoProblems,
  findClippedButtons,
  findSmallTargets,
  openInNarrowContainer,
  scaleRootText,
  settle,
} from '../playwright';

const DEMO = '/_demo/shell';

async function openShell(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(DEMO);
  await expect(page.locator('.shell')).toBeVisible();
  await expect(page.locator('.shell-page')).toBeVisible();
  await settle(page);
}

/** Adds a test button to the page. The button is not part of the product. */
async function addProbe(page: Page, html: string) {
  await page.evaluate((markup) => {
    const holder = document.createElement('div');
    holder.id = 'gilt-probe';
    holder.style.padding = '48px';
    holder.innerHTML = markup;
    document.querySelector('.shell-body')?.prepend(holder);
  }, html);
  await settle(page);
}

test.describe('GILT test tool: conditions', () => {
  test('the narrow container is 260 CSS px wide', async ({ page }) => {
    await openShell(page);
    const width = await openInNarrowContainer(page, '.shell-page');
    expect(width).toBe(NARROW_WIDTH);
    const box = await page.locator('.shell-page').boundingBox();
    expect(box?.width).toBe(NARROW_WIDTH);
    // The container decides the layout: the narrow header uses the phone padding.
    const header = page.locator('.shell-page .shell-hd').first();
    const inner = await header.evaluate((el) => el.getBoundingClientRect().width);
    expect(inner).toBeLessThanOrEqual(NARROW_WIDTH);
  });

  test('root text grows to 200 %', async ({ page }) => {
    await openShell(page);
    const before = await page.evaluate(() =>
      parseFloat(getComputedStyle(document.documentElement).fontSize),
    );
    await scaleRootText(page);
    const after = await page.evaluate(() =>
      parseFloat(getComputedStyle(document.documentElement).fontSize),
    );
    expect(after).toBe(before * 2);
  });

  test('pseudo language makes a button label at least two times longer and keeps codes', async ({
    page,
  }) => {
    await openShell(page);
    await addProbe(page, '<button type="button" id="code-probe">Order AB-120/XL</button>');
    const filter = page.getByRole('button', { name: 'Filtre', exact: true });
    const before = (await filter.innerText()).trim();
    await applyPseudoLocale(page, 'long');
    const after = (
      await page.locator('.shell-hd button').filter({ hasNotText: /^$/ }).first().innerText()
    ).trim();
    expect(after).not.toBe(before);
    const probe = (await page.locator('#code-probe').innerText()).trim();
    expect([...probe].length).toBeGreaterThanOrEqual([...'Order AB-120/XL'].length * 2);
    expect(probe.split(/\s+/)).toContain('AB-120/XL');
  });

  test('right-to-left pseudo language sets the direction and keeps codes', async ({ page }) => {
    await openShell(page);
    await addProbe(page, '<button type="button" id="code-probe">Order AB-120/XL</button>');
    await applyPseudoLocale(page, 'rtl');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    const probe = (await page.locator('#code-probe').innerText()).trim();
    expect(probe).toMatch(/[֐-׿]/);
    expect(probe.split(/\s+/)).toContain('AB-120/XL');
  });
});

test.describe('GILT test tool: checks catch broken buttons', () => {
  test('a button clipped on purpose fails the clipping check', async ({ page }) => {
    await openShell(page);
    await addProbe(
      page,
      `<button type="button" aria-label="Deneme kırpık düğme"
        style="inline-size:${MIN_TARGET + 20}px;block-size:${MIN_TARGET}px;overflow:hidden;white-space:nowrap">
        Betriebsumgebungstemperatur speichern</button>`,
    );
    const problems = await findClippedButtons(page, { scope: '#gilt-probe' });
    expect(problems.map((p) => p.accessibleName)).toEqual(['Deneme kırpık düğme']);
    expect(problems[0]?.visibleText).toContain('Betriebsumgebungstemperatur');
    expect(problems[0]?.box.width).toBe(MIN_TARGET + 20);
    const error = await expectNoProblems(page, test.info(), 'clipping', problems).catch(
      (e: Error) => e,
    );
    expect(String(error)).toContain(test.info().title);
    expect(String(error)).toContain('Deneme kırpık düğme');
  });

  test('a label that spills out of its button also fails', async ({ page }) => {
    await openShell(page);
    await addProbe(
      page,
      `<button type="button" style="inline-size:60px;block-size:${MIN_TARGET}px;white-space:nowrap">Betriebsumgebungstemperatur</button>`,
    );
    const problems = await findClippedButtons(page, { scope: '#gilt-probe' });
    expect(problems).toHaveLength(1);
    expect(problems[0]?.accessibleName).toBe('Betriebsumgebungstemperatur');
  });

  test('a button cut by its parent fails', async ({ page }) => {
    await openShell(page);
    await addProbe(
      page,
      `<div style="inline-size:80px;overflow:hidden"><button type="button" style="inline-size:160px;block-size:${MIN_TARGET}px">Speichern</button></div>`,
    );
    const problems = await findClippedButtons(page, { scope: '#gilt-probe' });
    expect(problems.map((p) => p.accessibleName)).toEqual(['Speichern']);
  });

  test('a 40 × 40 button fails the touch check and a 44 × 44 button passes', async ({ page }) => {
    await openShell(page);
    await addProbe(
      page,
      `<button type="button" aria-label="Küçük deneme" style="inline-size:40px;block-size:40px;padding:0"></button>
       <span style="display:inline-block;inline-size:48px"></span>
       <button type="button" aria-label="Yeterli deneme" style="inline-size:44px;block-size:44px;padding:0"></button>`,
    );
    const problems = await findSmallTargets(page, { scope: '#gilt-probe' });
    expect(problems.map((p) => p.accessibleName)).toEqual(['Küçük deneme']);
    expect(problems[0]?.box).toMatchObject({ width: 40, height: 40 });
    const error = await expectNoProblems(page, test.info(), 'touch', problems).catch(
      (e: Error) => e,
    );
    expect(String(error)).toContain('Küçük deneme');
  });

  test('the checks measure each button, not only the page width', async ({ page }) => {
    await openShell(page);
    await addProbe(
      page,
      `<button type="button" aria-label="Sığan ama kırpık" style="inline-size:50px;block-size:${MIN_TARGET}px;overflow:hidden;white-space:nowrap">Betriebsumgebungstemperatur</button>`,
    );
    const pageWidth = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(pageWidth).toBeLessThanOrEqual(0);
    expect(await findClippedButtons(page, { scope: '#gilt-probe' })).toHaveLength(1);
  });
});

const CONDITIONS = [
  { name: 'source language', apply: async () => undefined },
  { name: 'long pseudo language', apply: (page: Page) => applyPseudoLocale(page, 'long') },
  { name: 'right-to-left pseudo language', apply: (page: Page) => applyPseudoLocale(page, 'rtl') },
  {
    name: 'long pseudo language and 200 % text',
    apply: async (page: Page) => {
      await scaleRootText(page);
      await applyPseudoLocale(page, 'long');
    },
  },
  {
    name: 'German compound in a 260 px container',
    apply: async (page: Page) => {
      await openInNarrowContainer(page, '.shell-page');
      await applyPseudoLocale(page, 'german');
    },
  },
] as const;

test.describe('GILT test tool: shell buttons', () => {
  // Width alone does not mean touch. The touch target rule is the same on every device.
  test.use({ hasTouch: true });

  for (const condition of CONDITIONS) {
    test(`shell buttons are not clipped: ${condition.name}`, async ({ page }) => {
      await openShell(page);
      await condition.apply(page);
      await settle(page);
      await expectNoProblems(page, test.info(), 'clipping', await findClippedButtons(page));
    });

    test(`shell buttons have 44 × 44 touch targets: ${condition.name}`, async ({ page }) => {
      await openShell(page);
      await condition.apply(page);
      await settle(page);
      await expectNoProblems(page, test.info(), 'touch', await findSmallTargets(page));
    });
  }
});
