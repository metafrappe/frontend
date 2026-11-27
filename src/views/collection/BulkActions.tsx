import { Checkbox } from 'antd';
import { useId, useLayoutEffect, useRef, useState } from 'react';
import { CollectionButton as Button } from './CollectionControls';
import { useCollectionText } from './messages';

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
  const text = useCollectionText();
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
      <div role="region" aria-label={text('collection.bulk.region')} className="collection-bulk">
        <strong>{text('collection.bulk.selectedCount', { count: selected.length })}</strong>
        <Button
          id={openerId}
          aria-expanded={Boolean(open)}
          aria-controls={open ? previewId : undefined}
          onClick={() => {
            setPreview({ names, read: false, done: false });
            focusTarget.current = previewId + '-ack';
          }}
        >
          {text('collection.bulk.approveSelected')}
        </Button>
        <Button
          onClick={() => {
            setPreview(undefined);
            onClear();
          }}
        >
          {text('collection.bulk.clearSelection')}
        </Button>
      </div>
      {open && (
        <div
          id={previewId}
          role="region"
          aria-label={text('collection.bulk.previewRegion')}
          className="collection-preview"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              close();
            }
          }}
        >
          <p>
            <strong>{text('collection.bulk.previewTitle')}</strong>{' '}
            {text('collection.bulk.previewSummary', { count: selected.length, names })}
          </p>
          <p>{text('collection.bulk.risk')}</p>
          <Checkbox
            id={previewId + '-ack'}
            className="collection-checkbox collection-hit"
            checked={open.read}
            onChange={(event) => {
              setPreview({ ...open, read: event.target.checked });
            }}
          >
            {text('collection.bulk.previewAck')}
          </Checkbox>
          <div className="collection-preview-actions">
            <Button
              disabled={!open.read}
              onClick={() => {
                setPreview({ ...open, done: true });
              }}
            >
              {text('collection.bulk.approve')}
            </Button>
            <Button onClick={close}>{text('collection.bulk.cancel')}</Button>
          </div>
          <p role="status">{open.done ? text('collection.bulk.notConnected') : ''}</p>
        </div>
      )}
    </>
  );
}
