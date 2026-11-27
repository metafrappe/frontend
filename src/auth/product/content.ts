// Value propositions for the product page (G-165).
// Rule: the page presents only existing capabilities as available. Unbuilt ones go in the "Coming soon" section (`soon_title`).
// Each item is tied to a requirement. Texts live in `messages.json`.
import type messages from './messages.json';

export type ValueKey = keyof (typeof messages)['tr']['values'];

export interface ValueProp {
  key: ValueKey;
  /** Requirement ID on the product page. Example: `G-159`. */
  requirement: string;
  /** `ready`: available today. `soon`: not yet available. */
  status: 'ready' | 'soon';
  /**
   * Required only for `ready` items: evidence that the capability exists today.
   * Evidence is a verifiable file in the repository or a written-up live trial.
   * Without evidence the item stays in the "Coming soon" section (`soon_title`).
   */
  evidence?: string;
}

// Rule (review 1, finding 1): the backend endpoints and platform clients for platform sign-in and
// linked accounts are not yet live. So both are in the "Coming soon" section (`soon_title`).
// Once verified in production they become `ready` and their evidence is recorded.
// The intro text (`lead`, `lead_more`) makes no capability claims; it only describes the product (review 2).
export const valueProps: readonly ValueProp[] = [
  {
    key: 'single_door',
    requirement: 'G-158',
    status: 'ready',
    evidence:
      'src/auth/LoginScreen.tsx: "AtonotA Login ile oturum aç" düğmesi start_login akışını açar.',
  },
  {
    key: 'open_source',
    requirement: 'G-157',
    status: 'ready',
    evidence:
      'Proje sahibinin 23 Kasım 2026 kararları, 5. madde: ürün kodu MIT, Keycloak Apache-2.0.',
  },
  // Single-account sign-in to the panel, Press and tenant site is a P1 acceptance criterion; not yet verified.
  { key: 'one_account', requirement: 'G-158', status: 'soon' },
  { key: 'many_platforms', requirement: 'G-159', status: 'soon' },
  { key: 'linked_accounts', requirement: 'G-160', status: 'soon' },
  // Source: G-76 (Keycloak is deployed on Hetzner) and decision 27 in the KARARLAR file.
  { key: 'data_location', requirement: 'G-76', status: 'soon' },
  { key: 'access_rules', requirement: 'G-161', status: 'soon' },
  { key: 'strong_sign_in', requirement: 'G-163', status: 'soon' },
  { key: 'email_link', requirement: 'G-162', status: 'soon' },
  { key: 'identity_check', requirement: 'G-164', status: 'soon' },
];
