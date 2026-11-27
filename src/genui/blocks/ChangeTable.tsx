import { useId } from 'react';

import type { FieldChange } from '../types';

/**
 * Change table of the fixed confirm screen (AX-4, AX-6).
 *
 * Each field name is a header on its own row. The before and after values sit
 * side by side below it. So the table fits at 320 CSS px without scrolling and
 * words are not broken in the middle. Cells link to headers via `headers`.
 */
export function ChangeTable({ changes }: { changes: FieldChange[] }) {
  const id = useId();
  const before = `${id}-before`;
  const after = `${id}-after`;
  return (
    <table className="genui-changes" aria-label="Değişecek alanlar">
      <thead>
        <tr>
          <th scope="col" id={before}>
            Önce
          </th>
          <th scope="col" id={after}>
            Sonra
          </th>
        </tr>
      </thead>
      {changes.map((change, index) => {
        const field = `${id}-f${index}`;
        return (
          <tbody key={change.field}>
            <tr>
              <th scope="colgroup" colSpan={2} id={field} className="genui-change-field">
                {change.field}
              </th>
            </tr>
            <tr>
              <td headers={`${field} ${before}`}>{change.before || 'Boş'}</td>
              <td headers={`${field} ${after}`} className="genui-after">
                {change.after || 'Boş'}
              </td>
            </tr>
          </tbody>
        );
      })}
    </table>
  );
}
