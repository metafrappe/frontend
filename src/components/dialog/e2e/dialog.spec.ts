import { expect, test, type Page } from '../../../../tests/setup/playwright-fixtures';
import {
  applyPseudoLocale,
  expectNoProblems,
  findClippedButtons,
  findSmallTargets,
  openInNarrowContainer,
  scaleRootText,
  settle,
  type PseudoMode,
} from '../../../testing/gilt/playwright';

// Shared demo route (AGENTS.md, src/shell/routes.ts). Opens only in the e2e build.
const DEMO = '/_demo/dialog';

/** Confirm labels that do not say the result. A confirm button with only these words fails. */
const VAGUE = ['tamam', 'ok', 'okay', 'evet', 'yes', 'iptal', 'cancel', 'onayla', 'confirm'];

const MODES: PseudoMode[] = ['long', 'rtl', 'german'];

async function openDemo(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(DEMO);
  // The e2e build starts the mock server first. Under a full parallel run this can take a while.
  await expect(page.getByTestId('drafts')).toBeVisible({ timeout: 20_000 });
  await settle(page);
}

/** Boxes of the visible buttons in order. */
async function buttonBoxes(page: Page, scope: string) {
  return page.locator(`${scope} button:visible`).evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
    }),
  );
}

function expectStacked(boxes: { top: number; bottom: number }[], label: string) {
  expect(boxes.length, `${label}: two buttons`).toBeGreaterThanOrEqual(2);
  boxes.slice(1).forEach((box, i) => {
    const above = boxes[i]?.bottom ?? 0;
    expect(box.top, `${label}: button ${i + 2} is below button ${i + 1}`).toBeGreaterThanOrEqual(
      above - 1,
    );
  });
}

test.describe('Dialogs in a narrow area', () => {
  for (const mode of MODES) {
    test(`modal buttons stack and are not clipped at 260 px, 200 % text, ${mode}`, async ({
      page,
    }, testInfo) => {
      await openDemo(page);
      await page.getByTestId('remove-Mart taslağı').click();
      await expect(page.locator('.ant-modal-footer')).toBeVisible();
      await scaleRootText(page);
      await applyPseudoLocale(page, mode);
      await openInNarrowContainer(page, '.ant-modal');
      await settle(page);
      expectStacked(await buttonBoxes(page, '.ant-modal-footer'), 'modal');
      await expectNoProblems(
        page,
        testInfo,
        'clipping',
        await findClippedButtons(page, { scope: '.ant-modal' }),
      );
      await expectNoProblems(
        page,
        testInfo,
        'touch',
        await findSmallTargets(page, { scope: '.ant-modal-footer' }),
      );
      await testInfo.attach(`modal-${mode}`, {
        body: await page.locator('.ant-modal').screenshot(),
        contentType: 'image/png',
      });
    });
  }

  test('popconfirm buttons stack and are not clipped at 260 px with long text', async ({
    page,
  }, testInfo) => {
    await openDemo(page);
    await page.getByTestId('open-popconfirm').click();
    await expect(page.locator('.ant-popconfirm-buttons')).toBeVisible();
    await applyPseudoLocale(page, 'long');
    await openInNarrowContainer(page, '.ant-popover-inner');
    await settle(page);
    expectStacked(await buttonBoxes(page, '.ant-popconfirm-buttons'), 'popconfirm');
    await expectNoProblems(
      page,
      testInfo,
      'clipping',
      await findClippedButtons(page, { scope: '.ant-popover' }),
    );
    await expectNoProblems(
      page,
      testInfo,
      'touch',
      await findSmallTargets(page, { scope: '.ant-popconfirm-buttons' }),
    );
  });

  test('side panel close button is not clipped at 260 px with long text', async ({
    page,
  }, testInfo) => {
    await openDemo(page);
    await page.getByTestId('open-panel').click();
    await expect(page.locator('.ant-drawer-content')).toBeVisible();
    await scaleRootText(page);
    await applyPseudoLocale(page, 'long');
    await openInNarrowContainer(page, '.ant-drawer-content-wrapper');
    await expectNoProblems(
      page,
      testInfo,
      'clipping',
      await findClippedButtons(page, { scope: '.ant-drawer' }),
    );
  });
});

test.describe('Confirm buttons say the result', () => {
  async function expectResultLabel(page: Page, selector: string) {
    const button = page.locator(selector);
    await expect(button).toBeVisible();
    const visible = (await button.innerText()).trim();
    const name = (await button.getAttribute('aria-label')) ?? visible;
    for (const text of [visible, name]) {
      expect(VAGUE, `"${text}" does not say the result`).not.toContain(
        text.toLocaleLowerCase('tr'),
      );
    }
    // The accessible name is the visible text, so voice control finds the button.
    expect(name).toBe(visible);
  }

  test('modal and popconfirm confirm buttons name their result', async ({ page }) => {
    await openDemo(page);
    await page.getByTestId('remove-Mart taslağı').click();
    await expectResultLabel(page, '.ant-modal-footer .ant-btn-primary');
    await page.keyboard.press('Escape');
    await expect(page.locator('.ant-modal-footer')).toBeHidden();
    await page.getByTestId('open-long').click();
    await expectResultLabel(page, '.ant-modal-footer .ant-btn-primary');
    await page.keyboard.press('Escape');
    await page.getByTestId('open-popconfirm').click();
    await expectResultLabel(page, '.ant-popconfirm-buttons .ant-btn-primary');
  });
});

test.describe('Focus returns to a meaningful place', () => {
  test('closing a modal returns focus to the button that opened it', async ({ page }) => {
    await openDemo(page);
    const opener = page.getByTestId('open-long');
    await opener.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.ant-modal-footer')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.ant-modal-footer')).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test('closing a side panel and a popconfirm returns focus to the opener', async ({ page }) => {
    await openDemo(page);
    const panel = page.getByTestId('open-panel');
    await panel.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.ant-drawer-content')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.ant-drawer-content')).toBeHidden();
    await expect(panel).toBeFocused();

    const pop = page.getByTestId('open-popconfirm');
    await pop.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.ant-popconfirm-buttons')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(pop).toBeFocused();
  });

  test('when the opener is deleted, focus moves to the neighbouring record', async ({ page }) => {
    await openDemo(page);
    await page.getByTestId('remove-Nisan taslağı').click();
    await page.locator('.ant-modal-footer .ant-btn-primary').click();
    await expect(page.getByTestId('remove-Nisan taslağı')).toHaveCount(0);
    await expect(page.getByTestId('remove-Mayıs taslağı')).toBeFocused();

    // The last record has no next neighbour, so focus moves to the previous one.
    await page.getByTestId('remove-Mayıs taslağı').click();
    await page.locator('.ant-modal-footer .ant-btn-primary').click();
    await expect(page.getByTestId('remove-Mayıs taslağı')).toHaveCount(0);
    await expect(page.getByTestId('remove-Mart taslağı')).toBeFocused();
  });
});

test.describe('Short height with the phone keyboard open', () => {
  test.use({ viewport: { width: 320, height: 300 } });

  test('the last button stays visible and the body scrolls on its own', async ({
    page,
  }, testInfo) => {
    await openDemo(page);
    await page.getByTestId('open-long').click();
    const footer = page.locator('.ant-modal-footer');
    await expect(footer).toBeVisible();
    await applyPseudoLocale(page, 'long');
    await settle(page);
    const last = footer.locator('button').last();
    const box = (await last.boundingBox()) ?? { y: -1, height: 0 };
    expect(box.y, 'last button top is on screen').toBeGreaterThanOrEqual(0);
    expect(box.y + box.height, 'last button bottom is on screen').toBeLessThanOrEqual(300);
    // The page and the modal wrapper do not scroll. Only the body scrolls.
    const wrapScroll = await page
      .locator('.ant-modal-wrap')
      .evaluate((el) => el.scrollHeight - el.clientHeight);
    expect(wrapScroll, 'modal wrapper does not scroll').toBeLessThanOrEqual(1);
    const bodyScrolls = await page.locator('.ant-modal-body').evaluate((body) =>
      [body, ...Array.from(body.querySelectorAll<HTMLElement>('*'))].some((el) => {
        const style = getComputedStyle(el);
        return /(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 1;
      }),
    );
    expect(bodyScrolls, 'modal body scrolls on its own').toBe(true);
    await testInfo.attach('modal-320x300', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  });
});
