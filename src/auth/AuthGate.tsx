import { Button, Typography } from 'antd';
import { lazy, type ReactNode, Suspense, useEffect } from 'react';

import { userMessage } from '@/api/errors';

import { AuthLayout } from './AuthLayout';
import { LoginScreen } from './LoginScreen';
import { tr } from './messages.json';
import type { PlatformSession } from './session';
import { useAuthState } from './useAuthState';

export interface AuthGateProps {
  session: PlatformSession;
  /** Rendered when signed in. If a function is given, it receives the signed-in user's name. */
  children: ReactNode | ((user: string) => ReactNode);
  /** Brand name on the sign-in button. */
  brandName?: string;
}

/**
 * Platform buttons are a separate chunk. The chunk loads only when the sign-in screen opens.
 * It is not part of the initial load for signed-in users.
 */
const ProviderSignIn = lazy(() => import('./providers/ProviderSignIn'));

/**
 * Binds the panel to the session.
 * Checks the session on first load. With no session it shows the sign-in screen and does not redirect on its own.
 * On a server error it shows plain text and a retry button.
 */
export function AuthGate({ session, children, brandName }: AuthGateProps) {
  const state = useAuthState(session.auth);
  const text = tr;

  useEffect(() => {
    void session.auth.check();
  }, [session]);

  switch (state.status) {
    case 'signed_in':
      return <>{typeof children === 'function' ? children(state.user) : children}</>;
    case 'signed_out':
      return (
        <LoginScreen
          onSignIn={(provider) => session.auth.signIn(undefined, provider)}
          platforms={
            <Suspense fallback={null}>
              <ProviderSignIn
                api={session.api}
                button={Button}
                labels={{ list: text.providers_label, button: text.login_button }}
                onSignIn={(provider) => session.auth.signIn(undefined, provider)}
              />
            </Suspense>
          }
          {...(brandName ? { brandName } : {})}
          {...(state.notice ? { notice: state.notice } : {})}
        />
      );
    case 'error':
      return (
        <AuthLayout>
          <Typography.Paragraph role="alert" style={{ margin: 0 }}>
            {userMessage(state.error)}
          </Typography.Paragraph>
          <Button block onClick={() => void session.auth.check()}>
            {text.retry}
          </Button>
        </AuthLayout>
      );
    case 'redirecting':
      return (
        <AuthLayout>
          <Typography.Paragraph role="status" style={{ margin: 0 }}>
            {text.redirecting}
          </Typography.Paragraph>
        </AuthLayout>
      );
    case 'checking':
      return (
        <AuthLayout>
          <Typography.Paragraph role="status" style={{ margin: 0 }}>
            {text.checking}
          </Typography.Paragraph>
        </AuthLayout>
      );
  }
}
