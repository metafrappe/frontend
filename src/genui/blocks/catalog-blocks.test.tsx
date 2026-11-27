import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LanguageProvider } from '@/app/locale';

import { JsonView } from './JsonView';
import { KpisView } from './KpisView';
import { SourceView } from './SourceView';
import { TableView } from './TableView';

/** Açılış verisi henüz yok (AJA-1732). Dil, sahte açılış verisi gibi sağlayıcıya verilir. */
function inLanguage(language: string, node: JSX.Element) {
  return render(<LanguageProvider initialLanguage={language}>{node}</LanguageProvider>);
}

const table = {
  kind: 'table',
  title: 'Personel',
  rowKey: 'id',
  columns: [{ key: 'id', title: 'Kimlik' }],
  rows: [{ id: 'A' }, { id: 'B' }, { id: 'C' }],
} as const;

describe('genui blokları metni katalogdan alır', () => {
  it('Türkçe ekranda metinler değişmez', () => {
    inLanguage('tr', <TableView block={table as never} />);
    expect(screen.getByText('3 satır')).toBeInTheDocument();
  });

  it('İngilizce ekranda tek satır tekil yazılır', () => {
    inLanguage('en-GB', <TableView block={{ ...table, rows: [{ id: 'A' }] } as never} />);
    expect(screen.getByText('1 row')).toBeInTheDocument();
  });

  it('JSON, gösterge ve kaynak kartları dilin metnini gösterir', () => {
    inLanguage('tr', <JsonView raw={{ a: 1 }} />);
    expect(screen.getByText('Bu blok tanınmadı. Ham veri gösteriliyor.')).toBeInTheDocument();
    inLanguage('tr', <KpisView block={{ kind: 'kpis', items: [] } as never} />);
    expect(screen.getByRole('region', { name: 'Göstergeler' })).toBeInTheDocument();
    inLanguage('en', <SourceView block={{ kind: 'source', items: [] } as never} />);
    expect(screen.getByRole('group', { name: 'Source' })).toBeInTheDocument();
  });
});
