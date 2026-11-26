import { Checkbox } from 'antd';
import { Link } from 'react-router-dom';

import { useFormat } from '@/app/locale';

import { displayCell } from './presentation';
import { isNumeric } from './model';
import type { ViewProps } from './types';
export function TableView({
  definition,
  rows,
  selecting,
  selected,
  onSelect,
  recordHref,
}: ViewProps & {
  /** Seçim kipi açıksa ilk sütunda seçim kutuları görünür. */
  selecting: boolean;
  selected: string[];
  onSelect: (names: string[]) => void;
  /** Verilirse kayıt adı (`name` sütunu) kayda giden bağlantı olur. */
  recordHref?: ((name: string) => string) | undefined;
}) {
  const format = useFormat();
  return (
    <div
      className="collection-scroll"
      tabIndex={0}
      role="region"
      aria-label="Kayıt tablosu yatay kaydırma"
    >
      <table className="collection-table" data-view="table">
        <caption className="collection-sr-only">{definition.label} kayıtları</caption>
        <thead>
          <tr>
            {selecting && (
              <th className="collection-selection">
                <Checkbox
                  className="collection-checkbox collection-hit"
                  aria-label="Bu sayfadaki tüm kayıtları seç"
                  checked={rows.length > 0 && selected.length === rows.length}
                  indeterminate={selected.length > 0 && selected.length < rows.length}
                  onChange={(event) => {
                    onSelect(event.target.checked ? rows.map((row) => row.name) : []);
                  }}
                />
              </th>
            )}
            {definition.columns.map((field) => (
              <th
                key={field.fieldname}
                scope="col"
                className={isNumeric(field) ? 'collection-number' : 'collection-text'}
              >
                {field.label}
                {field.sensitivity === 'restricted' && (
                  <span className="collection-sensitive">Hassas alan</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} data-selected={selected.includes(row.name)}>
              {selecting && (
                <td className="collection-selection">
                  <Checkbox
                    className="collection-checkbox collection-hit"
                    aria-label={row.name + ' seç'}
                    checked={selected.includes(row.name)}
                    onChange={(event) => {
                      onSelect(
                        event.target.checked
                          ? [...selected, row.name]
                          : selected.filter((name) => name !== row.name),
                      );
                    }}
                  />
                </td>
              )}
              {definition.columns.map((field) => (
                <td
                  key={field.fieldname}
                  className={isNumeric(field) ? 'collection-number' : 'collection-text'}
                >
                  {recordHref && field.fieldname === 'name' ? (
                    <Link className="collection-record-link" to={recordHref(row.name)}>
                      {displayCell(row, field, format)}
                    </Link>
                  ) : (
                    displayCell(row, field, format)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
