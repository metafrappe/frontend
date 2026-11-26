import type { Page } from '../../../../tests/setup/playwright-fixtures';

/** Önizleme telefon düzenine 48rem altında geçer. Kök yazı %100 iken bu 768 px'tir. */
export function isPhone(page: Page) {
  return (page.viewportSize()?.width ?? 0) < 768;
}
/** Telefonda arama, süzgeç ve sıralama alanlarını açar. Geniş ekranda bir şey yapmaz. */
export async function openPhoneTools(page: Page) {
  if (!isPhone(page)) return;
  const tools = page.getByRole('group', { name: 'Liste araçları' });
  for (const name of [/^Süzgeç/, /^Sırala$/]) {
    const button = tools.getByRole('button', { name });
    if ((await button.getAttribute('aria-expanded')) !== 'true') await button.click();
  }
}
/** Telefonda kart yerine tabloyu gösterir. Geniş ekranda bir şey yapmaz. */
export async function showTable(page: Page) {
  if (!isPhone(page)) return;
  const toggle = page
    .getByRole('group', { name: 'Liste araçları' })
    .getByRole('button', { name: 'Tablo', exact: true });
  if ((await toggle.getAttribute('aria-pressed')) !== 'true') await toggle.click();
}
