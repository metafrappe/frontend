import { Checkbox } from 'antd';
import { Link } from 'react-router-dom';

import { useFormat } from '@/app/locale';

import { displayCell } from './presentation';
import type { ViewProps } from './types';

/**
 * Telefon kart satırı. Her kayıt bir kart olur.
 * Kartın başında ilk alan kalın yazılır. Öteki alanlar ad ve değer olarak sıralanır.
 * Kayıt adı kartın sonunda durur. `recordHref` verilirse kayıt adı bağlantı olur.
 */
export function CardView({
  definition,
  rows,
  selecting,
  selected,
  onSelect,
  recordHref,
}: ViewProps & {
  selecting: boolean;
  selected: string[];
  onSelect: (names: string[]) => void;
  recordHref?: ((name: string) => string) | undefined;
}) {
  const format = useFormat();
  const fields = definition.columns.filter((field) => field.fieldname !== 'name');
  const [lead, ...rest] = fields;
  return (
    <ul className="collection-cards" aria-label={definition.label + ' kayıtları'}>
      {rows.map((row) => (
        <li
          key={row.name}
          className="collection-card"
          data-selecting={selecting}
          data-selected={selected.includes(row.name)}
        >
          {selecting && (
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
          )}
          <div className="collection-card-body">
            {lead && (
              <strong className="collection-card-lead">{displayCell(row, lead, format)}</strong>
            )}
            {rest.length > 0 && (
              <dl className="collection-card-fields">
                {rest.map((field) => (
                  <div key={field.fieldname}>
                    <dt>{field.label}</dt>
                    <dd>{displayCell(row, field, format)}</dd>
                  </div>
                ))}
              </dl>
            )}
            <p className="collection-card-name">
              {recordHref ? (
                <Link className="collection-record-link" to={recordHref(row.name)}>
                  {row.name}
                </Link>
              ) : (
                row.name
              )}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
