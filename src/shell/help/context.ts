import { createContext, useContext } from 'react';

/** Yardım panelinin konusu. Sayfa ya da tek bir alan olabilir. */
export type HelpTarget =
  | { kind: 'page' }
  | {
      kind: 'field';
      /** Ekranda görünen alan adı. Ekran okuyucu işareti bu adla duyurur. */
      label: string;
      fieldname: string;
      /** Frappe alan açıklaması. Sunucu yardımı yoksa panel bunu gösterir. */
      description?: string | null | undefined;
      /** Alanın belge türü. Varsa panel sunucudan alan yardımını okur (G-138). */
      doctype?: string | undefined;
    }
  | {
      kind: 'component';
      /** Ekranda görünen bileşen adı. Ekran okuyucu işareti bu adla duyurur. */
      label: string;
      /** Yardım kaydındaki bileşen kimliği. Örnek: `record-form`. */
      componentId: string;
    };

export interface HelpApi {
  /** Kendi kendine destek modu açık mı? */
  selfHelp: boolean;
  /** Paneli açar. `trigger` paneli açan öğedir; panel kapanınca odak ona döner. */
  open: (target: HelpTarget, trigger: HTMLElement | null) => void;
}

export const HelpContext = createContext<HelpApi | null>(null);

/**
 * Alan işaretlerinin belge türü. Kayıt görünümü bunu verir.
 * Alan işareti bu değerle sunucudan alan yardımını ister.
 */
export const HelpDoctype = createContext<string | undefined>(undefined);

export const useHelpDoctype = () => useContext(HelpDoctype);

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
