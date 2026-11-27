import { useId } from 'react';

import { Input } from '@/components/controls';

import { PageHeader } from '../header/PageHeader';
import { t } from '../messages';
import { routes } from '../paths';

const noop = () => undefined;

/**
 * Dil seçimi deneme sayfası (AJA-1772). Yalnız e2e derlemesinde `/_demo/dil` adresinde açılır.
 * Sayfada yarım dolu bir form, bir taslak ve açık bir süzgeç vardır.
 * Değerler yalnız sayfanın kendi durumunda yaşar. Sayfa yenilenir ya da yeniden kurulursa silinir.
 * Tarayıcı testi dili değiştirir ve değerlerin kaldığını denetler.
 */
export default function LanguageDemoPage() {
  const id = useId();
  const text = t.languageDemo;
  return (
    <div className="shell-page">
      <PageHeader
        title={text.title}
        crumbs={[{ label: t.pages.home, to: routes.home() }, { label: text.title }]}
        view="report"
        onViewChange={noop}
        state={{ kind: 'normal', syncedAt: '10:42' }}
      />
      <div className="shell-body">
        <p>{text.intro}</p>
        <div className="shell-demo-field">
          <label htmlFor={`${id}-filter`}>{text.filter}</label>
          <Input id={`${id}-filter`} type="search" />
        </div>
        <form aria-label={text.form} className="shell-demo-form">
          <div className="shell-demo-field">
            <label htmlFor={`${id}-subject`}>{text.subject}</label>
            <Input id={`${id}-subject`} />
          </div>
          <div className="shell-demo-field">
            <label htmlFor={`${id}-draft`}>{text.draft}</label>
            <Input.TextArea id={`${id}-draft`} rows={3} />
          </div>
        </form>
      </div>
    </div>
  );
}
