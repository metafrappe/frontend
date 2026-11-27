import { createContext, useContext } from 'react';

/**
 * Open state of the assist panel. The shell holds the state.
 * Another button can also open the panel, e.g. the phone bottom bar.
 * When the panel closes, focus returns to the button that opened it.
 */
export interface AssistPanelApi {
  open: boolean;
  /** Opens or closes the panel. `opener` is the button focus returns to. */
  toggle: (opener?: HTMLElement | null) => void;
  close: () => void;
}

export const AssistPanelContext = createContext<AssistPanelApi | null>(null);

export function useAssistPanel(): AssistPanelApi | null {
  return useContext(AssistPanelContext);
}
