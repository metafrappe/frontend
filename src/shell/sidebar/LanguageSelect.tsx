import { useId } from 'react';

import { useLanguageChoice, type LocaleTag, type SaveLanguage } from '@/app/locale';
import { Select } from '@/components/controls';

interface LanguageSelectProps {
  /** Seçimi kullanıcı profiline yazar. */
  save: SaveLanguage;
}

/**
 * Dil düğmesi (AJA-1772). Markalı antd listesidir. Native `<select>` kullanılmaz.
 * Her seçenek adını kendi dilinde gösterir ve kendi `lang` değerini taşır (WCAG 3.1.2).
 * Ekran yalnız profil kaydı başarılı olunca değişir. Sayfa yeniden yüklenmez.
 * Bu yüzden adres, formlar, süzgeçler ve taslaklar kalır.
 * Kayıt reddedilirse eski dil kalır. Neden listenin altında görünür.
 */
export function LanguageSelect({ save }: LanguageSelectProps) {
  const id = useId();
  const { locale, pending, error, options, text, choose } = useLanguageChoice(save);
  return (
    <div className="shell-lang">
      <label htmlFor={id} className="shell-lang-label">
        {text.label}
      </label>
      <Select<LocaleTag>
        id={id}
        value={pending ?? locale}
        onChange={choose}
        disabled={pending !== undefined}
        loading={pending !== undefined}
        options={options.map(({ tag, name }) => ({
          value: tag,
          label: <span lang={tag}>{name}</span>,
        }))}
      />
      <span className="shell-vh" role="status">
        {pending === undefined ? '' : text.saving}
      </span>
      {error === undefined ? null : (
        <p role="alert" className="shell-lang-error">
          {error}
        </p>
      )}
    </div>
  );
}
