// Product page path. This file is small and goes into the main bundle.
// The page itself is a separate chunk (`ProductPage.tsx`). The chunk loads only at this path.

/** Path of the AtonotA Login product page. The page needs no session (G-165). */
export const PRODUCT_PATH = '/atonota-login';

/** Does the path belong to a page that needs no session? A single trailing `/` is accepted. */
export function isPublicPath(pathname: string): boolean {
  return pathname === PRODUCT_PATH || pathname === `${PRODUCT_PATH}/`;
}
