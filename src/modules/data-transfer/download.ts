/**
 * Metni dosya olarak indirir. Dosya tarayıcıda üretilir; sunucuya ikinci istek gitmez.
 * Başa UTF-8 imi (BOM) eklenir. Böylece tablo programları Türkçe harfleri doğru açar.
 */
export function saveTextFile(name: string, content: string) {
  const blob = new Blob(['\uFEFF', content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  // Tarayıcı indirmeyi başlatınca adres bırakılır.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

const UNSAFE = new Set('\\/:*?"<>|');

/** Dosya adında yol ayırıcı ve denetim karakteri kalmaz. */
export const fileName = (doctype: string, suffix = '') =>
  `${Array.from(doctype, (char) => (UNSAFE.has(char) || char.charCodeAt(0) < 32 ? '-' : char)).join('')}${suffix}.csv`;
