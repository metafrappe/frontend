/** Modül ortamının hangi koşul için kurulduğu. */
export interface ModuleEnvironmentKey {
  session: unknown;
  user: string;
  dataMode: string;
  locale: string;
}

/**
 * Kabuğun şu an kullanabileceği modül ortamını seçer.
 * Oturum, kullanıcı ya da veri kipi değiştiyse eski ortam kullanılmaz.
 * Yalnız dil değiştiyse eski ortam yenisi gelene kadar kalır (AJA-1772).
 * Böylece modül sayfası kaldırılmaz. Formu, süzgeci ve taslağı kalır.
 */
export function usableModuleEnvironment<Env>(
  loaded: (ModuleEnvironmentKey & { env: Env }) | undefined,
  current: ModuleEnvironmentKey,
): Env | undefined {
  if (
    !loaded ||
    loaded.session !== current.session ||
    loaded.user !== current.user ||
    loaded.dataMode !== current.dataMode
  ) {
    return undefined;
  }
  return loaded.env;
}
