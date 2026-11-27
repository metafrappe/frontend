import { Button, Typography } from 'antd';

import type { ReactNode } from 'react';

import type { SignedOutNotice } from './auth';
import { AuthLayout } from './AuthLayout';
import { tr } from './messages.json';
import { PRODUCT_PATH } from './product/path';

export interface LoginScreenProps {
  /**
   * Called when a sign-in button is pressed. A platform button passes the platform name.
   * The AtonotA Login button passes no name. Example: `(provider) => session.auth.signIn(undefined, provider)`.
   */
  onSignIn: (provider?: string) => void;
  /** Brand name on the button. Defaults to “AtonotA Login”. */
  brandName?: string;
  /** If given, a short note appears below the description. Example: `idp_session_may_remain`. */
  notice?: SignedOutNotice;
  /**
   * Platform buttons (G-159). Rendered below the AtonotA Login button.
   * AuthGate puts the lazy-loaded `ProviderSignIn` component here. If not given, only the
   * AtonotA Login button is shown.
   */
  platforms?: ReactNode;
}

/**
 * Screen for the sign-in route. The buttons start the backend `start_login` flow.
 * The layout is phone-first: there is side padding at 320 px wide and the buttons are full width.
 * Sizes come from the project's CSS variables inside AuthLayout.
 */
export function LoginScreen({
  onSignIn,
  brandName = tr.brand,
  notice,
  platforms,
}: LoginScreenProps) {
  const text = tr;
  return (
    <AuthLayout labelledBy="login-title">
      <Typography.Title level={1} id="login-title" style={{ margin: 0 }}>
        {text.login_title}
      </Typography.Title>
      <Typography.Paragraph style={{ margin: 0 }}>{text.login_body}</Typography.Paragraph>
      {notice ? (
        // The note is not rendered faded. The antd `secondary` colour does not reach 4.5:1 on 14 px text (review 2, Ö-1).
        <Typography.Paragraph role="status" style={{ margin: 0 }}>
          {text[notice]}
        </Typography.Paragraph>
      ) : null}
      <Button type="primary" block onClick={() => onSignIn(undefined)} style={{ width: '100%' }}>
        {text.login_button.replace('{brand}', brandName)}
      </Button>
      {platforms}
      <Typography.Paragraph style={{ margin: 0 }}>
        <a href={PRODUCT_PATH}>{text.product_link}</a>
      </Typography.Paragraph>
    </AuthLayout>
  );
}
