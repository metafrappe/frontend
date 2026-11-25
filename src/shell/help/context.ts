import { createContext, useContext } from 'react';

/** Yardım panelinin konusu. Sayfa ya da tek bir alan olabilir. */
export type HelpTarget =
  | { kind: 'page' }
  | {
      kind: 'field';
      /** Ekranda görünen alan adı. Ekran okuyucu işareti bu adla duyurur. */
      label: string;
      fieldname: string;
      /** Frappe alan açıklaması. Yoksa panel "yardım metni yok" yazar. */
      description?: string | null | undefined;
    };

export interface HelpApi {
  /** Kendi kendine destek modu açık mı? */
  selfHelp: boolean;
  /** Paneli açar. `trigger` paneli açan öğedir; panel kapanınca odak ona döner. */
  open: (target: HelpTarget, trigger: HTMLElement | null) => void;
}

export const HelpContext = createContext<HelpApi | null>(null);

/** Kabuk dışında (örneğin bileşen deneme sayfası) bağlam yoktur ve işaret çizilmez. */
export const useHelp = () => useContext(HelpContext);

/** Destek modu tercihinin tarayıcıdaki anahtarı. */
export const SELF_HELP_KEY = 'atonota.shell.selfHelp';

export function readSelfHelp(): boolean {
  try {
    return window.localStorage.getItem(SELF_HELP_KEY) === 'on';
  } catch {
    return false;
  }
}

export function writeSelfHelp(on: boolean) {
  try {
    window.localStorage.setItem(SELF_HELP_KEY, on ? 'on' : 'off');
  } catch {
    // Tarayıcı saklamaya izin vermiyor. Tercih yalnız bu oturumda kalır.
  }
}
