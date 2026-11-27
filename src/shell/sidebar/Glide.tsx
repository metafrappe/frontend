import type { CSSProperties } from 'react';

import type { GlideState } from './useGlide';

/** Gliding hover background layer. Position comes from the `useGlide` hook. */
export function Glide({ state }: { state: GlideState }) {
  return (
    <span
      className="shell-glide"
      aria-hidden="true"
      data-on={state.on ? 'true' : 'false'}
      data-jump={state.jump ? 'true' : 'false'}
      style={
        {
          '--shell-glide-y': `${state.top}px`,
          '--shell-glide-h': `${state.height}px`,
        } as CSSProperties
      }
    />
  );
}
