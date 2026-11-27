import { expect, test } from '../setup/playwright-fixtures';

/**
 * Browser tests do not send requests to the real server. The shared fixture catches `atonota.net` requests.
 * If the test has no route of its own, the request is aborted and the test fails.
 * `test.fail` expects this failure. If the fixture does not work, the test fails as "unexpectedly passed".
 */
const LOGIN_PROBE = 'https://api.login.atonota.net/__e2e-koruma-denemesi';
const ENV_PROBE = 'https://api.login.alpha.atonota.net/__e2e-koruma-denemesi';

test.describe('gerçek sunucu koruması', () => {
  test('yönlendirmesiz gezinme gerçek giriş sunucusuna gitmez ve testi düşürür', async ({
    page,
  }) => {
    test.fail(true, 'Ortak fixture beklenmeyen isteği yakalar ve testi düşürür.');
    await page.goto(LOGIN_PROBE).catch(() => undefined);
  });

  test('yönlendirmesiz fetch ortam sunucusuna gitmez ve testi düşürür', async ({ page }) => {
    test.fail(true, 'Ortak fixture beklenmeyen isteği yakalar ve testi düşürür.');
    await page.evaluate(async (url) => {
      await fetch(url, { mode: 'no-cors' }).catch(() => undefined);
    }, ENV_PROBE);
  });

  /**
   * Panel review 2, K-1: on the app page, the mock server's service worker handles requests.
   * In WebKit, Playwright does not see a request the worker passes to the network. So the mock server
   * aborts the `atonota.net` request in the worker and writes it to the browser console. The fixture reads this record.
   * The test does not use `test.fail`. So another error cannot make the test pass (review e5-1, K-1).
   * The fixture fails the test if the record is not empty. The two tests above cover this path.
   */
  test('uygulama sayfasında servis işçisi gerçek sunucu isteğini ağ hatasına düşürür', async ({
    page,
    gercekSunucuIstekleri,
  }) => {
    await page.goto('/');
    await page.waitForFunction(() => navigator.serviceWorker?.controller != null);
    const outcome = await page.evaluate(async (url) => {
      try {
        const response = await fetch(url);
        return `yanıt ${response.status}`;
      } catch {
        return 'ağ hatası';
      }
    }, ENV_PROBE);
    // The request does not reach the network. The page gets a network error, not a response.
    expect(outcome).toBe('ağ hatası');
    // The fixture records the aborted request. The test reads the record itself. So the test does not fail.
    await expect.poll(() => gercekSunucuIstekleri.peek()).toEqual([`GET ${ENV_PROBE}`]);
    gercekSunucuIstekleri.take();
  });

  test('testin kendi yönlendirmesi önce gelir ve test geçer', async ({ page }) => {
    await page.route(`${new URL(LOGIN_PROBE).origin}/**`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: '<title>Yerel yanıt</title>',
      }),
    );
    await page.goto(LOGIN_PROBE);
    await expect(page).toHaveTitle('Yerel yanıt');
  });
});
