import { expect, test } from '../../../../tests/setup/playwright-fixtures';

for (const theme of ['light', 'dark']) {
  test(`required checkbox exposes errors and keeps keyboard focus without a ring (${theme})`, async ({
    page,
  }, testInfo) => {
    await page.goto(`/src/views/record/harness/?scenario=checkbox&theme=${theme}`);
    const checkbox = page.getByRole('checkbox', { name: 'Bilgileri kontrol ettim' });
    const title = page.getByRole('textbox', { name: /Başlık/ });
    const save = page.getByRole('button', { name: 'Kaydet' });
    await expect(checkbox).not.toBeChecked();
    await expect(checkbox).not.toHaveAttribute('aria-invalid');
    const restingBorder = await checkbox.evaluate((input) => {
      const inner = input.nextElementSibling;
      if (!inner) throw new Error('Missing checkbox surface');
      return getComputedStyle(inner).borderColor;
    });

    await page.keyboard.press('Tab');
    await save.press('Enter');
    await expect(checkbox).toHaveAttribute('aria-invalid', 'true');
    await expect(checkbox).toBeFocused();
    await expect(title).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('.rv-root')).toHaveAttribute('data-rv-kbd', 'true');

    const focus = await checkbox.evaluate(async (input) => {
      const wrapper = input.closest('.ant-checkbox-wrapper');
      const inner = input.nextElementSibling;
      const parent = input.parentElement;
      const error = input.closest('.rv-field')?.querySelector('.rv-field-error');
      if (!wrapper || !inner || !parent || !error) {
        throw new Error('Missing checkbox surface or error');
      }
      await Promise.all(wrapper.getAnimations().map((animation) => animation.finished));
      const surfaces = [input, parent, inner, wrapper];
      return {
        outlines: surfaces.map((surface) => {
          const style = getComputedStyle(surface);
          return style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0;
        }),
        shadows: surfaces.map((surface) => getComputedStyle(surface).boxShadow),
        border: getComputedStyle(inner).borderColor,
        linkedError: input.getAttribute('aria-describedby')?.split(' ').includes(error.id),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    expect(focus.outlines).toEqual([false, false, false, false]);
    expect(focus.shadows.slice(0, 3)).toEqual(['none', 'none', 'none']);
    expect(focus.shadows[3]).toMatch(/(?:inset 0px -2px 0px 0px|0px -2px 0px 0px inset)/);
    expect(focus.border).toBe(restingBorder);
    expect(focus.linkedError).toBe(true);
    expect(focus.overflow).toBeLessThanOrEqual(0);
    await page.screenshot({
      path: testInfo.outputPath(`checkbox-error-${theme}.png`),
      fullPage: true,
    });

    await page.keyboard.press('Tab');
    await expect(title).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(checkbox).toBeFocused();
    await page.keyboard.press('Space');
    await expect(checkbox).toBeChecked();
    await expect(checkbox).not.toHaveAttribute('aria-invalid');
    await expect(checkbox).toHaveAccessibleDescription('Göndermeden önce bilgileri kontrol edin.');
    await expect(title).toHaveAttribute('aria-invalid', 'true');
    await save.press('Enter');
    await expect(title).toBeFocused();
  });
}
