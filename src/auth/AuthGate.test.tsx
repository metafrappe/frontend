import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { SAMPLE_CSRF_TOKEN, SAMPLE_USER } from '@/mocks/fixtures';
import { mockState, resetMockState } from '@/mocks/handlers';
import { mockServer } from '@/mocks/node';

import { AuthGate } from './AuthGate';
import { createPlatformSession } from './session';

const SITE = 'https://kiraci.example.test';

function setup() {
  const navigate = vi.fn<(url: string) => void>();
  const session = createPlatformSession({
    env: { VITE_SITE_URL: SITE },
    origin: SITE,
    document,
    navigate,
    currentPath: () => '/panel',
    csrfToken: SAMPLE_CSRF_TOKEN,
  });
  render(
    <AuthGate session={session}>
      <p>Panel içeriği</p>
    </AuthGate>,
  );
  return { session, navigate };
}

beforeAll(() => mockServer.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  mockServer.resetHandlers();
  resetMockState();
});
afterAll(() => mockServer.close());

describe('AuthGate', () => {
  it('çıkış adresi denetimden geçmezse giriş ekranı kimlik oturumu notunu gösterir', async () => {
    // The mock server returns a logout URL from another origin. The URL does not come from the Keycloak root.
    mockState.logoutOutcome = 'foreign_url';
    const { session, navigate } = setup();
    expect(await screen.findByText('Panel içeriği')).toBeInTheDocument();

    await act(() => session.auth.signOut());

    expect(await screen.findByRole('heading', { name: 'Oturum açın' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Panelden çıktınız. Kimlik oturumunuz açık kalmış olabilir.',
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it('önce oturumu denetler, sonra paneli gösterir', async () => {
    setup();
    expect(screen.getByRole('status')).toHaveTextContent('Oturum denetleniyor.');
    expect(await screen.findByText('Panel içeriği')).toBeInTheDocument();
  });

  it('oturum yoksa giriş ekranını gösterir ve kendiliğinden yönlendirmez', async () => {
    mockState.signedIn = false;
    const { navigate } = setup();

    expect(await screen.findByRole('heading', { name: 'Oturum açın' })).toBeInTheDocument();
    expect(screen.queryByText('Panel içeriği')).not.toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('giriş düğmesi arka ucun start_login yoluna gider', async () => {
    mockState.signedIn = false;
    const { navigate } = setup();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'AtonotA Login ile oturum aç' }));

    expect(navigate).toHaveBeenCalledWith(
      `${SITE}/api/method/platform_core.api.auth.start_login?redirect_to=%2Fpanel`,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Giriş sayfasına gidiliyor.');
  });

  it('giriş düğmesine klavyeyle basılabilir', async () => {
    mockState.signedIn = false;
    const { navigate } = setup();
    const user = userEvent.setup();
    await screen.findByRole('button', { name: 'AtonotA Login ile oturum aç' });

    await user.tab();
    await user.keyboard('{Enter}');

    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('giriş ekranı açık platformları sunucudan okur, kapalı platformu göstermez', async () => {
    mockState.signedIn = false;
    setup();
    const list = await screen.findByRole('list', { name: 'Başka bir hesapla oturum açın' });
    expect(list).toHaveTextContent('Google ile oturum aç');
    expect(screen.getByRole('button', { name: 'Facebook ile oturum aç' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'LinkedIn ile oturum aç' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'X ile oturum aç' })).toBeVisible();
    expect(screen.queryByRole('button', { name: /GitHub/ })).not.toBeInTheDocument();
  });

  it('platform düğmesi start_login yoluna platform adıyla gider', async () => {
    mockState.signedIn = false;
    const { navigate } = setup();
    await userEvent
      .setup()
      .click(await screen.findByRole('button', { name: 'Google ile oturum aç' }));
    expect(navigate).toHaveBeenCalledWith(
      `${SITE}/api/method/platform_core.api.auth.start_login?redirect_to=%2Fpanel&provider=google`,
    );
  });

  it('platform listesi okunamazsa yalnız AtonotA Login düğmesi kalır', async () => {
    mockState.signedIn = false;
    mockServer.use(
      http.get('*/api/method/platform_core.api.auth.list_login_providers', () =>
        HttpResponse.json({ exc_type: 'Exception' }, { status: 500 }),
      ),
    );
    setup();
    await screen.findByRole('button', { name: 'AtonotA Login ile oturum aç' });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('sunucu hatasında yalın metin ve yeniden deneme düğmesi gösterir', async () => {
    mockServer.use(
      http.get('*/api/method/frappe.auth.get_logged_user', () =>
        HttpResponse.json({ exc_type: 'SessionExpired', session_expired: 1 }, { status: 503 }),
      ),
    );
    const { navigate } = setup();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Hizmet şu an çalışmıyor. Birkaç dakika sonra yeniden deneyin.',
    );
    expect(navigate).not.toHaveBeenCalled();

    mockServer.resetHandlers();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Yeniden dene' }));
    expect(await screen.findByText('Panel içeriği')).toBeInTheDocument();
  });

  it('bekleme ve hata ekranları da telefon önce yerleşimi kullanır', async () => {
    mockServer.use(
      http.get('*/api/method/frappe.auth.get_logged_user', () =>
        HttpResponse.json({ exc_type: 'ServerError' }, { status: 500 }),
      ),
    );
    setup();
    const usesProjectSpacing = (element: HTMLElement | null) =>
      element?.style.paddingInline === 'var(--space-md)' &&
      element.style.maxWidth === 'var(--form-max-width)';
    expect(usesProjectSpacing(screen.getByRole('status').closest('main'))).toBe(true);
    expect(usesProjectSpacing((await screen.findByRole('alert')).closest('main'))).toBe(true);
  });

  it('oturumdaki kullanıcıyı alt bileşene verir', async () => {
    const navigate = vi.fn();
    const session = createPlatformSession({
      env: { VITE_SITE_URL: SITE },
      origin: SITE,
      document,
      navigate,
      currentPath: () => '/panel',
    });
    render(<AuthGate session={session}>{(user) => <p>Kullanıcı: {user}</p>}</AuthGate>);
    expect(await screen.findByText(`Kullanıcı: ${SAMPLE_USER}`)).toBeInTheDocument();
  });
});
