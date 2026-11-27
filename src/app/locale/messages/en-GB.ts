/**
 * Kaynak katalog: İngiliz İngilizcesi (Karar 44, AJA-1407).
 * Anahtar İngilizce ve ASCII yazılır. Biçim: `<alan>.<parça>.<ad>`.
 * Eylem ve durum ayrı anahtardır. Örnek: `x.action.open` düğme, `x.status.open` durum.
 * Yeni metin önce buraya, sonra öteki kataloglara eklenir.
 */
export const enGB = {
  'controls.dropdown.noResults': 'No results.',
  'genui.choices.label': 'Suggestions',
  'genui.json.unknownBlock': 'This block was not recognised. Showing the raw data.',
  'genui.kpis.label': 'Indicators',
  'genui.source.title': 'Source',
  'genui.table.rowCount': '{count, plural, one {# row} other {# rows}}',
} as const;

export type MessageKey = keyof typeof enGB;
