// Platform buttons for the sign-in screen (G-159). This file is not in the initial load.
// AuthGate loads it with `import()` only when the sign-in screen opens. Signed-in users never download it.
// The list comes from the server; there is no platform list in code. If the list cannot be read, no buttons are rendered.
//
// The button component and texts come from the sign-in screen. This chunk does not import the UI library or the
// message catalogue itself. If it did, the bundler would re-split the shared chunks of the initial load
// and the phone's initial load would grow (review 1, finding 10).
import type { Button as AntButton } from 'antd';
import { useEffect, useState } from 'react';

import type { ApiClient, LoginProvider } from '@/api';
import { createLoginClient } from '@/api/login-client';

/** Component for a platform button. The sign-in screen passes the antd `Button` component. Only the type is imported. */
export type ProviderButton = typeof AntButton;

export interface ProviderLabels {
  /** Accessible name of the list. Example: `providers_label` in `messages.json` (“Sign in with another account”). */
  list: string;
  /** Button text. `{brand}` is replaced by the platform name. Example: `login_button` in `messages.json` (“Sign in with {brand}”). */
  button: string;
}

export interface ProviderListProps {
  providers: readonly LoginProvider[];
  labels: ProviderLabels;
  button: ProviderButton;
  /** Called with the platform name when a platform button is pressed. Example: `'google'`. */
  onSignIn: (provider: string) => void;
}

/** Platform buttons. Nothing is rendered when the list is empty. */
export function ProviderList({ providers, labels, button: Button, onSignIn }: ProviderListProps) {
  if (providers.length === 0) return null;
  return (
    <ul
      aria-label={labels.list}
      style={{
        listStyle: 'none',
        margin: 0,
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-sm)',
      }}
    >
      {providers.map((provider) => (
        <li key={provider.alias}>
          <Button block onClick={() => onSignIn(provider.alias)} style={{ width: '100%' }}>
            {labels.button.replace('{brand}', provider.display_name)}
          </Button>
        </li>
      ))}
    </ul>
  );
}

export interface ProviderSignInProps extends Omit<ProviderListProps, 'providers'> {
  api: Pick<ApiClient, 'frappeDocument'>;
}

/** Reads the platform list from the server and renders the buttons. */
export default function ProviderSignIn({ api, ...list }: ProviderSignInProps) {
  const [providers, setProviders] = useState<readonly LoginProvider[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    createLoginClient(api)
      .listLoginProviders({ signal: controller.signal })
      .then(
        (items) => {
          if (!controller.signal.aborted) setProviders(items);
        },
        () => {
          if (!controller.signal.aborted) setProviders([]);
        },
      );
    return () => controller.abort();
  }, [api]);
  return <ProviderList providers={providers} {...list} />;
}
