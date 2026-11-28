import { Button, Input } from 'antd';
import { useId, useMemo } from 'react';

import type { TourDefinition } from '../model';
import { createBrowserTourStore } from '../store';
import { TourPanel, TourRestartButton } from '../TourPanel';
import { useTour } from '../useTour';

/** Deneme turu. Adımlar hedefsiz, alan hedefli ve kimlik hedefli üç türü dener. */
const demoTour: TourDefinition = {
  id: 'demo-leave-application',
  version: 1,
  label: 'Tur denemesi',
  steps: [
    {
      id: 'intro',
      title: 'Hoş geldiniz',
      body: 'Bu kısa tur izin isteğini nasıl yazacağınızı gösterir.',
    },
    {
      id: 'reason',
      title: 'Gerekçe',
      body: 'İzin gerekçesini bu alana yazın. Tur açıkken de yazabilirsiniz.',
      target: { doctype: 'Leave Application', fieldname: 'reason' },
    },
    {
      id: 'save',
      title: 'Kaydet',
      body: 'Bitince kaydet düğmesine basın.',
      target: { tourId: 'demo-save' },
    },
  ],
};

/**
 * G-139 tur motorunun deneme sayfası. Yalnız e2e derlemesinde `/_demo/tour` yolunda açılır.
 * İlerleme tarayıcı deposunda durur. Sayfayı yenilemek sonraki ziyareti taklit eder.
 * Ürün sayfaları sunucu deposunu kullanır: `@/api/tour-client`.
 */
export default function TourDemoPage() {
  const store = useMemo(() => createBrowserTourStore(window.localStorage, 'demo-user'), []);
  const tour = useTour({ definition: demoTour, store });
  const reasonId = useId();
  return (
    <div className="shell-page">
      <div className="shell-body">
        <h1>Tur denemesi</h1>
        <p>
          <TourRestartButton tour={tour} />
        </p>
        <form
          data-doctype="Leave Application"
          aria-label="İzin formu"
          onSubmit={(event) => event.preventDefault()}
        >
          <div data-fieldname="reason">
            <label htmlFor={reasonId}>Gerekçe</label>
            <Input id={reasonId} name="reason" />
          </div>
          <p>
            <Button type="primary" htmlType="submit" data-tour-id="demo-save">
              Kaydet
            </Button>
          </p>
        </form>
        <TourPanel tour={tour} />
      </div>
    </div>
  );
}
