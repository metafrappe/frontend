import { Alert, Button } from 'antd';
import { useCallback, useState } from 'react';
import { appendUnique } from '../../api/request-order';
import { useModule } from '../context';
import { useRead } from '../data';
import { useCopy } from '../messages';
import { DateValue } from '../shared';
import { parsePermissionLogs, type PermissionLogEntry } from './contracts';
import { AdminResource } from './shared';
import type { AdminClient } from '../runtime';

const PAGE = 20;

function PermissionLogList({ admin }: { admin: AdminClient }) {
  const copy = useCopy();
  const [pages, setPages] = useState(1);
  // Sayfalar sırayla okunur. "Daha eski kayıtlar" bir sayfa daha ekler.
  const load = useCallback(
    async (signal: AbortSignal) => {
      let logs: PermissionLogEntry[] = [];
      let hasMore = false;
      for (let page = 0; page < pages; page += 1) {
        const result = parsePermissionLogs(
          await admin.listPermissionLogs({ start: page * PAGE, page_length: PAGE }, { signal }),
        );
        // A new entry can shift the next page by one record. Each record still shows once.
        logs = appendUnique(logs, result.logs);
        hasMore = result.hasMore;
        if (!hasMore) break;
      }
      return { logs, hasMore };
    },
    [admin, pages],
  );
  const read = useRead(load, `permission-log:${pages}`);
  return (
    <AdminResource state={read.state} retry={read.refresh}>
      {({ logs, hasMore }) => (
        <div className="module-stack">
          {logs.length === 0 ? (
            <p>{copy.logEmpty}</p>
          ) : (
            <ul className="module-records">
              {logs.map((entry) => (
                <li key={entry.name} className="module-stack">
                  <p>
                    <DateValue value={entry.changedAt} />
                  </p>
                  <p>{entry.changedBy ?? copy.systemUser}</p>
                  <p>
                    {entry.forDoctype}: {entry.forDocument} ({copy[entry.status]})
                  </p>
                  {entry.changes.length > 0 && (
                    <details>
                      <summary>{copy.detail}</summary>
                      <dl>
                        {entry.changes.map((change) => (
                          <div key={change.field}>
                            <dt>{change.field}</dt>
                            <dd>
                              {copy.before}: {change.from || copy.nullValue}
                            </dd>
                            <dd>
                              {copy.after}: {change.to || copy.nullValue}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}
          {hasMore && (
            <div className="module-actions">
              <Button onClick={() => setPages((value) => value + 1)}>{copy.olderLogs}</Button>
            </div>
          )}
        </div>
      )}
    </AdminResource>
  );
}

/** "Değişiklik kaydı" bölümü. Yalnız okunur. */
export default function PermissionLog() {
  const env = useModule();
  const copy = useCopy();
  const admin = env?.client?.admin;
  if (!admin) return <Alert type="info" message={copy.unavailable} />;
  return <PermissionLogList admin={admin} />;
}
