/**
 * Reloads the page in the browser.
 * A new release deletes the old page files. Reloading fetches the new file names.
 * When the network drops, reloading also requests the file again.
 */
export function reloadPage(): void {
  window.location.reload();
}
