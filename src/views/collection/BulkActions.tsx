import { Checkbox } from 'antd';
import { useId, useLayoutEffect, useRef, useState } from 'react';
import { CollectionButton as Button } from './CollectionControls';

/** Onay ucu bağlanana kadar sonuç alanı yalnız bu metni yazar. Sahte başarı gösterilmez. */
export const BULK_NOT_CONNECTED = 'Kayıtlar değişmedi. Onay işlemi henüz bağlı değil.';

/**
 * Toplu işlem satırı ve önizleme. Satır yalnız en az bir kayıt seçiliyken çizilir.
 * Önizleme okunmadan "Onayla" düğmesi kapalı kalır.
 */
export function BulkActions({
  selected,
  onClear,
}: {
  selected: readonly string[];
  /** Seçimi kaldırır. Odak "Seç" düğmesine taşınır. */
  onClear: () => void;
}) {
  const id = useId();
  const openerId = id + '-approve';
  const previewId = id + '-preview';
  const [preview, setPreview] = useState<{ names: string; read: boolean; done: boolean }>();
  // Odak hedefi çizimden sonra odaklanır. Örneğin önizleme kapanınca odak açan düğmeye döner.
  const focusTarget = useRef<string | undefined>(undefined);
  useLayoutEffect(() => {
    if (!focusTarget.current) return;
    document.getElementById(focusTarget.current)?.focus();
    focusTarget.current = undefined;
  });
  const names = selected.join(', ');
  // Seçim değişirse eski önizleme geçersizdir ve kapanır.
  const open = preview?.names === names ? preview : undefined;
  if (selected.length === 0) return null;
  function close() {
    setPreview(undefined);
    focusTarget.current = openerId;
  }
  return (
    <>
      <div role="region" aria-label="Toplu işlem" className="collection-bulk">
        <strong>{selected.length} kayıt seçildi</strong>
        <Button
          id={openerId}
          aria-expanded={Boolean(open)}
          aria-controls={open ? previewId : undefined}
          onClick={() => {
            setPreview({ names, read: false, done: false });
            focusTarget.current = previewId + '-ack';
          }}
        >
          Seçilenleri onayla
        </Button>
        <Button
          onClick={() => {
            setPreview(undefined);
            onClear();
          }}
        >
          Seçimi kaldır
        </Button>
      </div>
      {open && (
        <div
          id={previewId}
          role="region"
          aria-label="Toplu işlem önizlemesi"
          className="collection-preview"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              close();
            }
          }}
        >
          <p>
            <strong>Önizleme.</strong> {selected.length} kayıt onaylanır: {names}.
          </p>
          <p>Risk düzeyi: R2 Orta. Çok kaydı değiştirir.</p>
          <Checkbox
            id={previewId + '-ack'}
            className="collection-checkbox collection-hit"
            checked={open.read}
            onChange={(event) => {
              setPreview({ ...open, read: event.target.checked });
            }}
          >
            Önizlemeyi okudum.
          </Checkbox>
          <div className="collection-preview-actions">
            <Button
              disabled={!open.read}
              onClick={() => {
                setPreview({ ...open, done: true });
              }}
            >
              Onayla
            </Button>
            <Button onClick={close}>Vazgeç</Button>
          </div>
          <p role="status">{open.done ? BULK_NOT_CONNECTED : ''}</p>
        </div>
      )}
    </>
  );
}
