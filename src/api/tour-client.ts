// Tur ilerlemesi istemcisi (G-139).
//
// Bu dosya ilk yüke girmez. Turu olan sayfa onu `import()` ile yükler.
// İstekler ortak istemciden geçer: `frappeDocument` site kökünü, CSRF başlığını,
// zaman aşımını ve oturum süresi işini üstlenir.
//
// Uçlar `platform_core.api.tour` modülündedir. Sözleşme metafrappe/backend deposundaki
// `contracts/platform_core-tour.openapi.yaml` dosyasıdır.
// Kullanıcıyı sunucu oturumdan bilir. İstek gövdesi kullanıcı adı taşımaz.
import { isTourProgress, type TourProgress } from '@/shell/tour/model';
import type { TourSaveOptions, TourStore } from '@/shell/tour/store';

import type { ApiClient } from './client';
import { ApiError } from './errors';

const METHOD = '/api/method/platform_core.api.tour.';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function createTourClient(api: Pick<ApiClient, 'frappeDocument'>): TourStore {
  async function call(
    request: {
      method: 'GET' | 'POST';
      name: string;
      query?: Record<string, string>;
      body?: object;
    },
    allowNull: boolean,
  ): Promise<TourProgress | null> {
    const response = await api.frappeDocument({
      method: request.method,
      path: `${METHOD}${request.name}`,
      ...(request.query ? { query: request.query } : {}),
      ...(request.body ? { body: request.body } : {}),
    });
    if (!response.ok) throw response.error;
    const value = isRecord(response.body) ? response.body.message : undefined;
    if (value === null && allowNull) return null;
    if (!isTourProgress(value)) {
      throw new ApiError({ kind: 'invalid_response', status: response.status });
    }
    return value;
  }

  return {
    /** Oturum sahibinin ilerlemesi. İlk ziyarette `null`. */
    load(tourId: string) {
      return call({ method: 'GET', name: 'get_tour_progress', query: { tour_id: tourId } }, true);
    },

    /** İlerlemeyi yazar. Sunucu görülen adımları birleştirir ve sonucu döner. */
    async save(progress: TourProgress, options: TourSaveOptions = {}) {
      const saved = await call(
        {
          method: 'POST',
          name: 'save_tour_progress',
          body: { ...progress, restart: options.restart === true },
        },
        false,
      );
      if (saved === null) throw new ApiError({ kind: 'invalid_response', status: 200 });
      return saved;
    },
  };
}
