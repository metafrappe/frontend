/**
 * Kontrol deneme sayfası. Yalnız e2e derlemesinde `/_demo/controls` yolunda açılır.
 * Rota satırı `src/shell/routes.ts` içindedir.
 */
import { useState } from 'react';

import {
  Button,
  Card,
  Checkbox,
  Dropdown,
  Input,
  InputNumber,
  Link,
  Radio,
  Select,
  SplitDropdown,
  Switch,
  Tabs,
  Tag,
} from '..';
import type { DropdownItem, DropdownStyle } from '..';

import './demo.css';

const sizes = ['small', 'middle', 'large'] as const;
const styles: DropdownStyle[] = ['classic', 'shortcut', 'described', 'selectable', 'searchable'];
const items: DropdownItem[] = [
  { key: 'edit', label: 'Düzenle', group: 'Kayıt', description: 'Kaydı aç', shortcut: 'Enter' },
  { key: 'copy', label: 'Kopyala', group: 'Kayıt', description: 'Kaydı kopyala', shortcut: 'C' },
  { key: 'locked', label: 'Taşı', disabled: true, group: 'Kayıt' },
  {
    key: 'history',
    label: 'Bu kaydın daha önce yapılan tüm değişikliklerini görüntüle',
    group: 'Geçmiş',
  },
  { key: 'delete', label: 'Sil', danger: true },
];

export default function ControlsDemoPage() {
  const [action, setAction] = useState('');
  const [submits, setSubmits] = useState(0);

  return (
    <div className="controls-demo">
      <section className="controls-demo-row">
        {styles.map((style) => (
          <Dropdown
            key={style}
            label={style === 'classic' ? 'İşlemler' : style}
            style={style}
            items={items}
            selectedKey="copy"
            onSelect={setAction}
          />
        ))}
        <Checkbox data-testid="checkbox">Seç</Checkbox>
        <output data-testid="action">{action}</output>
      </section>
      <section className="controls-demo-row controls-demo-isolated">
        <SplitDropdown
          label="Dışa aktar"
          menuLabel="Dışa aktarma seçenekleri"
          items={items}
          onAction={() => setAction('export')}
          onSelect={setAction}
        />
      </section>
      {sizes.map((size) => (
        <section className="controls-demo-row" key={size} data-testid={`row-${size}`}>
          <Button size={size} data-testid={`button-${size}`}>
            Kaydet
          </Button>
          <Input aria-label="Ad" size={size} data-testid={`input-${size}`} />
          <Select
            aria-label="Durum"
            size={size}
            options={[
              { value: 'open', label: 'Açık' },
              { value: 'closed', label: 'Kapalı' },
            ]}
            defaultValue="open"
          />
          <InputNumber aria-label="Adet" size={size} data-testid={`number-${size}`} />
          <Link href="#example" size={size} data-testid={`link-${size}`}>
            Kartı gör
          </Link>
        </section>
      ))}
      <section className="controls-demo-row">
        <Radio.Group aria-label="Görünüm" defaultValue="first" data-testid="radio-buttons">
          <Radio.Button value="first" data-testid="radio">
            Birinci
          </Radio.Button>
          <Radio.Button value="second">İkinci</Radio.Button>
        </Radio.Group>
        <Switch aria-label="Etkin" data-testid="switch" />
        <Tabs options={['Gün', 'Ay']} data-testid="tabs" />
        <Tag data-testid="tag">Açık</Tag>
        <Card id="example" data-testid="card">
          Örnek kart
        </Card>
      </section>
      <section className="controls-demo-row">
        <Radio.Group aria-label="Sıklık" defaultValue="week" data-testid="radio-cards">
          <Radio value="week">Haftalık</Radio>
          <Radio value="month">Aylık</Radio>
        </Radio.Group>
        <Checkbox.Group<string>
          aria-label="Bildirimler"
          defaultValue={['mail']}
          options={[
            { value: 'mail', label: 'E-posta' },
            { value: 'sms', label: 'Kısa mesaj' },
          ]}
        />
      </section>
      <section className="controls-demo-row">
        <form
          data-testid="text-form"
          onSubmit={(event) => {
            event.preventDefault();
            setSubmits((count) => count + 1);
          }}
        >
          <Input aria-label="Kısa not" maxLength={10} showCount data-testid="limited" />
          <output data-testid="submit-count">{submits}</output>
        </form>
      </section>
    </div>
  );
}
