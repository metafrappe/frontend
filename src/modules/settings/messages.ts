/** Ayar sayfalarının ekran metinleri (G-97). */
export const settingsMessages = {
  tr: {
    general: 'Genel ayarlar',
    branding: 'Marka',
    hr: 'İK ayarları',
    save: 'Ayarları kaydet',
    noClient: 'Ayar bağlantısı kurulmadı. Bu sayfa şimdilik açılamıyor.',
  },
  en: {
    general: 'General settings',
    branding: 'Branding',
    hr: 'HR settings',
    save: 'Save settings',
    noClient: 'The settings connection is not set up. This page cannot open yet.',
  },
} as const;

export type SettingsMessageKey = keyof (typeof settingsMessages)['tr'];
