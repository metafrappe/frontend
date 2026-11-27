import { doctypeFromSlug } from './view-data';
import { foldCode } from './locale/code';

// Yalnız kayıt rotası kullanır; kayıt parçasıyla tembel iner.

/**
 * DocType adını adres parçasına çevirir. Örnek: `Örnek Kayıt` -> `örnek-kayıt`.
 * Parça aynı ada geri çevrilemiyorsa `undefined` döner; o zaman bağlantı çizilmez.
 */
export function slugFromDoctype(doctype: string): string | undefined {
  // `foldCode` dile bakmaz. Adres parçası kullanıcının diline göre değişmez (G-132).
  const slug = foldCode(doctype).split(/\s+/).filter(Boolean).join('-');
  return slug !== '' && doctypeFromSlug(slug) === doctype ? slug : undefined;
}
