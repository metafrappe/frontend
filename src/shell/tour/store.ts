/**
 * Tur ilerlemesi depoları. Ürün sayfaları sunucu deposunu kullanır: `@/api/tour-client`.
 * Bellek deposu birim testleri içindir. Tarayıcı deposu yalnız deneme sayfası içindir.
 * Üç depo da sunucunun birleştirme kuralını uygular (`mergeProgress`).
 */
import { isTourProgress, mergeProgress, type TourProgress } from './model';

export interface TourSaveOptions {
  /** Turu baştan başlatır. Görülen adımlar silinir. */
  restart?: boolean;
}

export interface TourStore {
  /** İlk ziyarette `null` döner. */
  load(tourId: string): Promise<TourProgress | null>;
  /** Birleştirilmiş ilerlemeyi döner. */
  save(progress: TourProgress, options?: TourSaveOptions): Promise<TourProgress>;
}

export function createMemoryTourStore(): TourStore {
  const records = new Map<string, TourProgress>();
  return {
    load: (tourId) => Promise.resolve(records.get(tourId) ?? null),
    save(progress, options = {}) {
      const merged = mergeProgress(
        records.get(progress.tour_id) ?? null,
        progress,
        options.restart === true,
      );
      records.set(progress.tour_id, merged);
      return Promise.resolve(merged);
    },
  };
}

/** `localStorage` gibi en küçük depolama arayüzü. */
export interface TourBacking {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const KEY = 'atonota.tour';

/** Yalnız deneme sayfası içindir. Anahtar kullanıcıyı ve turu taşır. */
export function createBrowserTourStore(backing: TourBacking, user: string): TourStore {
  const key = (tourId: string) => `${KEY}:${user}:${tourId}`;
  const read = (tourId: string): TourProgress | null => {
    try {
      const value: unknown = JSON.parse(backing.getItem(key(tourId)) ?? 'null');
      return isTourProgress(value) ? value : null;
    } catch {
      return null;
    }
  };
  return {
    load: (tourId) => Promise.resolve(read(tourId)),
    save(progress, options = {}) {
      const merged = mergeProgress(read(progress.tour_id), progress, options.restart === true);
      backing.setItem(key(progress.tour_id), JSON.stringify(merged));
      return Promise.resolve(merged);
    },
  };
}
