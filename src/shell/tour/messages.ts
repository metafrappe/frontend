/**
 * Tur panelinin görünen metinleri. Tur içeriğini (adım başlığı ve metni) tur tanımı verir.
 * Değer gerektiren metinler işlevdir. Cümle parçalardan birleştirilmez.
 */
export const tourText = {
  label: (name: string) => `Tur: ${name}`,
  progress: (current: number, total: number) => `Adım ${current} / ${total}`,
  announce: (current: number, total: number, title: string) =>
    `Adım ${current} / ${total}: ${title}`,
  back: 'Geri',
  next: 'İleri',
  finish: 'Bitir',
  snooze: 'Ertele',
  skip: 'Turu atla',
  restart: 'Turu yeniden başlat',
} as const;
