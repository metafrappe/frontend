import { CalendarBlank } from '@phosphor-icons/react';
import { DatePicker } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import 'dayjs/locale/tr';
import type { ReactNode } from 'react';

import { SERVER_DATE_FORMAT, SERVER_DATETIME_FORMAT } from '../dateFormat';
import type { FieldControlA11yProps } from './FieldShell';

// Sunucu değerini katı kalıpla okumak için gerekir. antd da aynı eklentiyi kullanır.
dayjs.extend(customParseFormat);

/** Frappe değerini tarih nesnesine çevirir. Boş ya da bozuk değer `null` olur. */
function parseServerValue(value: unknown, withTime: boolean): Dayjs | null {
  if (typeof value !== 'string') return null;
  // Frappe saniyeden sonra mikro saniye gönderebilir: `2026-11-27 14:05:00.000000`.
  const trimmed = value.trim().split('.')[0] ?? '';
  if (!trimmed) return null;
  const candidates = withTime
    ? [SERVER_DATETIME_FORMAT, 'YYYY-MM-DD HH:mm', SERVER_DATE_FORMAT]
    : [SERVER_DATE_FORMAT];
  for (const pattern of candidates) {
    const parsed = dayjs(trimmed, pattern, true);
    if (parsed.isValid()) return parsed;
  }
  return null;
}

/** Takvim ekran kenarından taşarsa ekranın içine kaydırılır (AJA-476). */
const PICKER_POPUP_ALIGN = {
  overflow: { adjustX: 1, adjustY: 1, shiftX: true, shiftY: true },
} as const;

export interface DateFieldProps {
  /** Alan türü: yalnız tarih ya da tarih ve saat. */
  kind: 'date' | 'datetime';
  value: unknown;
  /** Gösterim kalıpları. Kullanıcının dil ayarından gelir. Örnek: `DD.MM.YYYY`. */
  formats: { date: string; time: string };
  readOnly: boolean;
  compact: boolean;
  a11y: FieldControlA11yProps;
  onChange: (next: string) => void;
}

/**
 * Markalı tarih alanı. Tarayıcının kendi tarih kutusu kullanılmaz.
 * Kutu tarihi kullanıcının biçimiyle gösterir: Türkçe arayüzde `27.11.2026`.
 * Sunucuya giden değer hep Frappe biçimindedir: `2026-11-27`.
 * Kullanıcı tarihi klavyeyle yazabilir ya da takvimden seçebilir.
 */
export function DateField({
  kind,
  value,
  formats,
  readOnly,
  compact,
  a11y,
  onChange,
}: DateFieldProps): ReactNode {
  const withTime = kind === 'datetime';
  const displayFormat = withTime ? `${formats.date} ${formats.time}` : formats.date;
  const serverFormat = withTime ? SERVER_DATETIME_FORMAT : SERVER_DATE_FORMAT;
  return (
    <DatePicker
      id={a11y.controlId}
      aria-labelledby={a11y.labelId}
      aria-describedby={a11y.ariaDescribedBy}
      aria-invalid={a11y.ariaInvalid}
      className="rv-date-picker"
      // Takvim kayıt kökünün içinde açılır (AJA-476). Böylece kayıt tokenları ve
      // klavye odak kuralları takvime de uygulanır.
      getPopupContainer={(trigger) => trigger.closest<HTMLElement>('.rv-root') ?? document.body}
      // antd takvimi yalnız sağa ya da sola hizalar. Dar ekranda iki yön de taşabilir.
      // `shiftX` ve `shiftY` takvimi ekranın içine kaydırır.
      popupAlign={PICKER_POPUP_ALIGN}
      size={compact ? 'small' : 'middle'}
      format={displayFormat}
      placeholder={displayFormat}
      showTime={withTime ? { format: formats.time } : false}
      showNow={withTime}
      needConfirm={false}
      suffixIcon={<CalendarBlank weight="regular" aria-hidden="true" />}
      inputReadOnly={readOnly}
      allowClear={!readOnly}
      {...(readOnly ? { open: false } : {})}
      value={parseServerValue(value, withTime)}
      onChange={(next: Dayjs | null) => onChange(next ? next.format(serverFormat) : '')}
    />
  );
}
