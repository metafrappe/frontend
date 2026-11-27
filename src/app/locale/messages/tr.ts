import type { Catalog } from './format-message';
import type { MessageKey } from './en-GB';

/**
 * Türkçe katalog. Var olan Türkçe metin buraya aynen taşınır.
 * Eksik anahtar için kaynak katalogdaki (en-GB) metin görünür.
 */
export const tr: Catalog<MessageKey> = {
  'controls.dropdown.noResults': 'Sonuç yok.',
  'genui.choices.label': 'Öneriler',
  'genui.json.unknownBlock': 'Bu blok tanınmadı. Ham veri gösteriliyor.',
  'genui.kpis.label': 'Göstergeler',
  'genui.source.title': 'Kaynak',
  'genui.table.rowCount': '{count, plural, other {# satır}}',
};
