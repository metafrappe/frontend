/**
 * Page gate information (G-94, G-169). The shell asks the server for read permission for the menu.
 * The module page reads the same information from this context. So the menu and page share one rule.
 * Without the context the gate is not applied. Example: a unit test without the shell.
 */
import { createContext, useContext } from 'react';

export interface ShellAccess {
  /** The server has responded, or permission information will never arrive. */
  ready: boolean;
  /** DocType names the user can read. */
  readable: ReadonlySet<string>;
}

export const ShellAccessContext = createContext<ShellAccess | null>(null);

export function useShellAccess(): ShellAccess | null {
  return useContext(ShellAccessContext);
}
