import { describe, expect, it } from 'vitest';
import { applySavedView, readQuery, toListRequest, writeQuery } from './query';
import { sampleDefinition } from './sample';
import type { SavedView } from './types';

const savedViews: readonly SavedView[] = [
  { id: 'bekleyen', label: 'Bekleyenler', query: { filter: 'status', value: 'Açık' } },
  { id: 'tutar', label: 'Tutara göre', query: { sort: 'amount', direction: 'desc' } },
  { id: 'tumu', label: 'Tümü', query: {} },
];

describe('collection URL state', () => {
  it('reads filter, sort, search and saved view from a shared link', () => {
    const params = new URLSearchParams(
      'saved=bekleyen&filter=status&value=A%C3%A7%C4%B1k&sort=amount&direction=desc&search=%C3%96rnek',
    );
    const query = readQuery(params, sampleDefinition, savedViews);
    expect(query).toMatchObject({
      saved: 'bekleyen',
      filter: 'status',
      value: 'Açık',
      sort: 'amount',
      direction: 'desc',
      search: 'Örnek',
    });
    expect(
      readQuery(writeQuery(new URLSearchParams(), query), sampleDefinition, savedViews),
    ).toEqual(query);
  });

  it('ignores unknown fields, values and saved views', () => {
    const query = readQuery(
      new URLSearchParams('saved=yok&filter=gizli&value=x&sort=bilinmeyen&direction=yan&view=x'),
      sampleDefinition,
      savedViews,
    );
    expect(query).toMatchObject({
      saved: '',
      filter: '',
      value: '',
      sort: 'name',
      direction: 'asc',
      view: 'table',
    });
    expect(toListRequest(sampleDefinition, query).filters).toEqual([]);
  });

  it('ignores a saved view when no saved views are given', () => {
    expect(readQuery(new URLSearchParams('saved=bekleyen'), sampleDefinition).saved).toBe('');
  });

  it('applies a saved view over a clean query and keeps page size and view type', () => {
    const base = readQuery(
      new URLSearchParams('search=eski&filter=status&value=Kapal%C4%B1&size=50&page=3'),
      sampleDefinition,
      savedViews,
    );
    expect(applySavedView(base, savedViews[1]!)).toMatchObject({
      saved: 'tutar',
      search: '',
      filter: '',
      value: '',
      sort: 'amount',
      direction: 'desc',
      size: 50,
      page: 1,
      view: 'table',
    });
  });

  it('keeps unrelated address fields when writing', () => {
    const params = writeQuery(
      new URLSearchParams('sekme=2&saved=tumu'),
      readQuery(new URLSearchParams(), sampleDefinition, savedViews),
    );
    expect(params.get('sekme')).toBe('2');
    expect(params.has('saved')).toBe(false);
  });
});
