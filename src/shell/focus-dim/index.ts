/**
 * Shell binding for the focus dim (D1–D5).
 *
 * TEMPORARY: the `foundation` work's `src/engines/focus-dim/` engine is not yet
 * on the `main` branch. This folder applies the same decision inside the shell. Once
 * the engine lands, `useFocusDim` will only call that engine. Components use this
 * hook, so no component changes during the switch-over.
 */
export { FocusDimProvider } from './FocusDimProvider';
export { useFocusDim } from './useFocusDim';
