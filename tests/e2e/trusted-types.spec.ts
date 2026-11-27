import { expect, test } from '@playwright/test';

/** GV-2 ve GV-6: içerik güvenlik politikası yayımlanan yanıtta sınanır (AJA-2283). */
test('önizleme yanıtı Trusted Types başlığını rapor kipinde gönderir', async ({ page }) => {
  const response = await page.goto('/');
  expect(response).not.toBeNull();
  const headers = response!.headers();
  expect(headers['content-security-policy-report-only']).toBe("require-trusted-types-for 'script'");
  expect(headers['content-security-policy']).toBeUndefined();
});
