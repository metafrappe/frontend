import { Button, Card, Flex, Input, Modal, Select, Space, Table, Typography } from 'antd';
import { useState } from 'react';

import { FOCUS_DIM_SOURCE_CLASS, useFocusDim } from '@/engines/focus-dim';
import { HitSuffix } from '@/engines/hit-area';

import { ThemeModeSwitch } from './ThemeModeSwitch';

const sizeOptions = [
  { value: 'sm', label: 'Küçük' },
  { value: 'md', label: 'Orta' },
  { value: 'lg', label: 'Büyük' },
];

/** Wide table example: columns are not squeezed; the table scrolls inside its own container. */
const tableColumns = [
  { title: 'Kayıt adı', dataIndex: 'name', key: 'name', minWidth: 'var(--table-col-min-title)' },
  {
    title: 'Belge türü',
    dataIndex: 'docType',
    key: 'docType',
    minWidth: 'var(--table-col-min-text)',
  },
  { title: 'Tarih', dataIndex: 'date', key: 'date', minWidth: 'var(--table-col-min-date)' },
  { title: 'Tutar', dataIndex: 'amount', key: 'amount', minWidth: 'var(--table-col-min-number)' },
  { title: 'Durum', dataIndex: 'status', key: 'status', minWidth: 'var(--table-col-min-text)' },
].map(({ minWidth, ...col }) => ({
  ...col,
  onHeaderCell: () => ({ style: { minWidth } }),
  onCell: () => ({ style: { minWidth } }),
}));

const tableRows = [
  {
    key: '1',
    name: 'Örnek Kayıt 1',
    docType: 'Teklif',
    date: '23 Kasım 2026',
    amount: '1.250,00',
    status: 'Açık',
  },
  {
    key: '2',
    name: 'Örnek Kayıt 2',
    docType: 'Sipariş',
    date: '22 Kasım 2026',
    amount: '980,50',
    status: 'Onaylı',
  },
];

/** Button for trying the focus scrim. The element that opened it stays above the scrim. */
function FocusDimDemo() {
  const [open, setOpen] = useState(false);
  useFocusDim(open, 'demo');
  return (
    <Button
      data-testid="dim-toggle"
      className={FOCUS_DIM_SOURCE_CLASS}
      aria-pressed={open}
      onClick={() => setOpen((v) => !v)}
    >
      {open ? 'Perdeyi kapat' : 'Perdeyi aç'}
    </Button>
  );
}

/**
 * Primary button inside a card and a modal. In the dark theme the card renders on the panel surface (#1F1F23)
 * and the modal on the elevated surface (#2A2A30). The primary button background is a solid colour, so
 * contrast is the same on every surface; the browser test measures this.
 */
function SurfaceButtonsDemo() {
  const [open, setOpen] = useState(false);
  return (
    <section aria-labelledby="surfaces-title">
      <Typography.Title level={2} id="surfaces-title">
        Kart ve pencere
      </Typography.Title>
      <Card title="Örnek kart" data-testid="demo-card">
        <Flex gap="middle" wrap align="center">
          <Typography.Text>Kart içindeki birincil düğme panel zemininde durur.</Typography.Text>
          <Button type="primary" data-testid="btn-card-primary">
            Kaydet
          </Button>
          <Button data-testid="modal-open" onClick={() => setOpen(true)}>
            Pencereyi aç
          </Button>
          <Button type="text" danger data-testid="btn-card-danger-text">
            Kartı sil
          </Button>
        </Flex>
      </Card>
      <Modal
        title="Kaydı sil"
        open={open}
        onOk={() => setOpen(false)}
        onCancel={() => setOpen(false)}
        okText="Tamam"
        cancelText="Vazgeç"
        okButtonProps={{ 'data-testid': 'btn-modal-primary' }}
        data-testid="demo-modal"
      >
        <Typography.Paragraph>
          Bu kayıt silinecek. Devam etmek istiyor musunuz?
        </Typography.Paragraph>
        <Button type="text" danger data-testid="btn-modal-danger-text">
          Kalıcı sil
        </Button>
      </Modal>
    </section>
  );
}

/**
 * Foundation preview and demo page. Opens at `/_demo/foundation` only in the e2e build.
 * Shows the design decisions and engines; the browser gates run on this page.
 */
export default function FoundationPage() {
  return (
    <main
      style={{
        padding: 'var(--space-lg) var(--space-md)',
        maxWidth: 'var(--content-max-width)',
        marginInline: 'auto',
      }}
    >
      <style>{`
        .foundation-small-button.hit::after {
          inset-block: calc((100% - var(--hit-target)) / 2);
        }
      `}</style>
      <Flex vertical gap="large">
        <Flex justify="space-between" align="center" wrap gap="small">
          <Typography.Title level={1} style={{ margin: 0 }}>
            Atonota
          </Typography.Title>
          <ThemeModeSwitch />
        </Flex>
        <Typography.Paragraph>
          Arayüz temeli hazır. Bu sayfa tasarım kararlarını gösterir.
        </Typography.Paragraph>

        <section aria-labelledby="buttons-title">
          <Typography.Title level={2} id="buttons-title">
            Butonlar
          </Typography.Title>
          <Flex gap="middle" wrap align="center">
            <Button size="small" className="foundation-small-button" data-testid="btn-sm">
              Küçük
            </Button>
            <Button type="primary" data-testid="btn-md">
              Orta
            </Button>
            <Button size="large" data-testid="btn-lg">
              Büyük
            </Button>
            <Button disabled data-testid="btn-disabled">
              Pasif
            </Button>
            <Button type="primary" danger data-testid="btn-danger-primary">
              Sil
            </Button>
            <Button danger data-testid="btn-danger-outlined">
              Sil
            </Button>
            <Button type="text" danger data-testid="btn-danger-text">
              Sil
            </Button>
            <Button type="link" danger data-testid="btn-danger-link">
              Sil
            </Button>
            <FocusDimDemo />
          </Flex>
          <Space.Compact style={{ marginTop: 'var(--space-md)' }} data-testid="compact">
            <Button data-testid="compact-left">Sol</Button>
            <Button data-testid="compact-right">Sağ</Button>
          </Space.Compact>
        </section>

        <section aria-labelledby="inputs-title">
          <Typography.Title level={2} id="inputs-title">
            Giriş alanları
          </Typography.Title>
          <Flex vertical gap="middle">
            <Input aria-label="Ad" placeholder="Ad" suffix={<HitSuffix />} data-testid="input-md" />
            <Select
              aria-label="Boyut"
              placeholder="Boyut seçin"
              options={sizeOptions}
              style={{ width: '100%' }}
              data-testid="select-md"
            />
            <Typography.Paragraph style={{ margin: 0 }}>
              Yardım için <a href="#yardim">yardım sayfasına</a> bakın.
            </Typography.Paragraph>
          </Flex>
        </section>

        <SurfaceButtonsDemo />

        <section aria-labelledby="table-title" data-testid="wide-table">
          <Typography.Title level={2} id="table-title">
            Geniş tablo
          </Typography.Title>
          <div data-scroll-x tabIndex={0} role="region" aria-labelledby="table-title">
            <Table columns={tableColumns} dataSource={tableRows} pagination={false} size="middle" />
          </div>
        </section>
      </Flex>
    </main>
  );
}
