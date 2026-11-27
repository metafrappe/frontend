import { fireEvent } from '@testing-library/react';

/**
 * Tarih alanına klavyeyle tarih yazar ve Enter tuşuna basar.
 * Tarih alanı markalı seçicidir (panel sorunu 3). Değer kullanıcının biçimiyle yazılır.
 * Örnek: Türkçe arayüzde `27.11.2026`.
 */
export function typeDate(input: HTMLElement, text: string): void {
  fireEvent.mouseDown(input);
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: text } });
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', keyCode: 13 });
}
