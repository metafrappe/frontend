// This folder is owned by the `api-client` task.
// The web panel holds no access token. Sign-in goes through the backend Keycloak flow.
// README.md explains how to plug it into the panel.
export { createAuth, isSafeLogoutUrl, isSafeRedirect, startLoginUrl } from './auth';
export type { Auth, AuthDeps, AuthState, SignedOutNotice } from './auth';
export { AuthGate } from './AuthGate';
export type { AuthGateProps } from './AuthGate';
export { LoginScreen } from './LoginScreen';
export type { LoginScreenProps } from './LoginScreen';
export { createPlatformSession } from './session';
export type { PlatformSession, PlatformSessionDeps } from './session';
export { useAuthState } from './useAuthState';
