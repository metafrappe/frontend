import { Alert, Button, Checkbox, Input, Select } from 'antd';

import { ActionDialog } from '@/components/dialog';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { useModule } from '../context';
import { useRead } from '../data';
import { useCopy } from '../messages';
import { moduleRegistrations } from '../registry';
import type { AdminClient } from '../runtime';
import {
  LEVEL_RIGHTS,
  RIGHTS,
  parseRolePermissions,
  parseRoles,
  type PermissionRow,
  type Right,
} from './contracts';
import { fill } from './format';
import { AdminResource } from './shared';
import './admin.css';

/**
 * Başlangıçta gösterilen kayıt türleri: panel sayfalarının okuduğu iş türleri.
 * Platform türleri (`PLT ` öneki) kiracı yöneticisine kapalıdır. Sunucu da 403 verir.
 */
const STARTING_DOCTYPES = [
  ...new Set(
    moduleRegistrations
      .flatMap((entry) => entry.requires ?? [])
      .filter((doctype) => !doctype.startsWith('PLT ')),
  ),
];

type ChangeKey = `${string}|${number}|${Right}`;
const keyOf = (doctype: string, level: number, right: Right): ChangeKey =>
  `${doctype}|${level}|${right}`;

function rowsFor(doctype: string, rows: PermissionRow[]): PermissionRow[] {
  // Rolün bu türde satırı yoksa boş bir 0 düzeyi satırı gösterilir. Yönetici izni buradan verir.
  if (rows.length > 0) return rows;
  const rights = Object.fromEntries(
    RIGHTS.map((right) => [right, false]),
  ) as PermissionRow['rights'];
  return [{ doctype, permlevel: 0, rights }];
}

export function RoleMatrix({ admin }: { admin: AdminClient }) {
  const copy = useCopy();
  const id = useId();
  const [role, setRole] = useState<string>();
  const [doctypes, setDoctypes] = useState<string[]>(STARTING_DOCTYPES);
  const [draftDoctype, setDraftDoctype] = useState('');
  const [changes, setChanges] = useState<Map<ChangeKey, boolean>>(new Map());
  const [reviewing, setReviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [outcome, setOutcome] = useState<{ saved: boolean; failed: string[] }>();
  const loadRoles = useCallback(
    async (signal: AbortSignal) => parseRoles(await admin.listRoles({ signal })),
    [admin],
  );
  const roles = useRead(loadRoles, 'roles');
  const loadMatrix = useCallback(
    async (signal: AbortSignal) => {
      if (!role) return [];
      const tables = await Promise.all(
        doctypes.map(async (doctype) =>
          rowsFor(
            doctype,
            parseRolePermissions(await admin.listRolePermissions(doctype, { signal }), role),
          ),
        ),
      );
      return tables.flat();
    },
    [admin, doctypes, role],
  );
  const matrix = useRead(role ? loadMatrix : null, `${role ?? ''}:${doctypes.join('|')}`);
  const roleInfo =
    roles.state.status === 'ready'
      ? roles.state.data.find((entry) => entry.name === role)
      : undefined;
  const readOnly = roleInfo?.standard ?? true;
  const rows = matrix.state.status === 'ready' ? matrix.state.data : [];

  const scroller = useRef<HTMLDivElement>(null);
  const [scrolls, setScrolls] = useState(false);
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const measure = () => setScrolls(element.scrollWidth > element.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [rows.length, role]);

  /**
   * Kutu odaktayken sol ve sağ ok tuşu kutuyu kaydırır. WebKit bunu kendiliğinden yapmaz.
   * Yalnız kutunun kendisi odaktaysa çalışır. Onay kutusundaki ok tuşu etkilenmez.
   */
  function scrollByKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const step = event.currentTarget.clientWidth / 4;
    event.currentTarget.scrollBy({ left: event.key === 'ArrowRight' ? step : -step });
  }
  const value = (row: PermissionRow, right: Right) =>
    changes.get(keyOf(row.doctype, row.permlevel, right)) ?? row.rights[right];
  function toggle(row: PermissionRow, right: Right, checked: boolean) {
    setOutcome(undefined);
    setChanges((current) => {
      const next = new Map(current);
      const key = keyOf(row.doctype, row.permlevel, right);
      if (checked === row.rights[right]) next.delete(key);
      else next.set(key, checked);
      return next;
    });
  }
  const changeList = useMemo(
    () =>
      [...changes.entries()].map(([key, after]) => {
        const [doctype = '', level = '0', right = 'read'] = key.split('|');
        return { doctype, level: Number(level), right: right as Right, after };
      }),
    [changes],
  );

  async function save() {
    if (!role || saving) return;
    setSaving(true);
    const groups = new Map<
      string,
      { doctype: string; permlevel: number; permissions: Record<string, boolean> }
    >();
    for (const change of changeList) {
      const key = `${change.doctype}|${change.level}`;
      const group = groups.get(key) ?? {
        doctype: change.doctype,
        permlevel: change.level,
        permissions: {},
      };
      group.permissions[change.right] = change.after;
      groups.set(key, group);
    }
    const results = await Promise.allSettled(
      [...groups.values()].map((group) => admin.setRolePermission({ role, ...group }, {})),
    );
    const failed: string[] = [];
    const remaining = new Map(changes);
    [...groups.values()].forEach((group, index) => {
      if (results[index]?.status === 'fulfilled') {
        for (const right of Object.keys(group.permissions))
          remaining.delete(keyOf(group.doctype, group.permlevel, right as Right));
      } else failed.push(fill(copy.rowFailed, { doctype: group.doctype, level: group.permlevel }));
    });
    setChanges(remaining);
    setSaving(false);
    setReviewing(false);
    setOutcome({ saved: failed.length === 0, failed });
    matrix.refresh();
  }

  function chooseRole(next: string) {
    setRole(next);
    setChanges(new Map());
    setOutcome(undefined);
  }

  return (
    <AdminResource state={roles.state} retry={roles.refresh}>
      {(list) => (
        <div className="module-stack">
          <label htmlFor={`${id}-role`}>{copy.role}</label>
          <Select<string>
            id={`${id}-role`}
            value={role ?? null}
            onChange={chooseRole}
            options={list.map((entry) => ({ value: entry.name, label: entry.name }))}
          />
          {role && readOnly && <p>{copy.standardRole}</p>}
          {role && (
            <AdminResource state={matrix.state} retry={matrix.refresh}>
              {() => (
                <div className="module-stack">
                  {scrolls && <p>{copy.matrixScrolls}</p>}
                  <div
                    ref={scroller}
                    className="module-scroll"
                    data-scroll-x
                    role="region"
                    tabIndex={0}
                    aria-label={fill(copy.matrixLabel, { role })}
                    onKeyDown={scrollByKeyboard}
                  >
                    <table className="module-table admin-matrix-table">
                      <thead>
                        <tr>
                          <th scope="col">{copy.doctype}</th>
                          <th scope="col">{copy.permlevel}</th>
                          {RIGHTS.map((right) => (
                            <th scope="col" key={right}>
                              {copy[right]}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => (
                          <tr key={`${row.doctype}|${row.permlevel}`}>
                            <th scope="row">{row.doctype}</th>
                            <td>{row.permlevel}</td>
                            {RIGHTS.map((right) =>
                              row.permlevel > 0 && !LEVEL_RIGHTS.includes(right) ? (
                                <td key={right}>
                                  <span aria-hidden="true">—</span>
                                  <span className="admin-hidden">{copy.rightMissing}</span>
                                </td>
                              ) : (
                                <td key={right}>
                                  <Checkbox
                                    aria-label={fill(copy.rowLabel, {
                                      doctype: row.doctype,
                                      level: row.permlevel,
                                      right: copy[right],
                                    })}
                                    checked={value(row, right)}
                                    disabled={readOnly || saving}
                                    onChange={(event) => toggle(row, right, event.target.checked)}
                                  />
                                </td>
                              ),
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!readOnly && (
                    <form
                      className="admin-inline"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const doctype = draftDoctype.trim();
                        if (doctype && !doctypes.includes(doctype))
                          setDoctypes([...doctypes, doctype]);
                        setDraftDoctype('');
                      }}
                    >
                      <div className="module-stack">
                        <label htmlFor={`${id}-doctype`}>{copy.addDoctype}</label>
                        <Input
                          id={`${id}-doctype`}
                          maxLength={140}
                          value={draftDoctype}
                          onChange={(event) => setDraftDoctype(event.target.value)}
                        />
                      </div>
                      <Button htmlType="submit" disabled={!draftDoctype.trim()}>
                        {copy.added}
                      </Button>
                    </form>
                  )}
                </div>
              )}
            </AdminResource>
          )}
          {outcome?.saved && <Alert role="status" type="success" message={copy.saved} />}
          {outcome && outcome.failed.length > 0 && (
            <Alert
              role="alert"
              type="error"
              message={copy.uncertain}
              description={
                <ul>
                  {outcome.failed.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              }
            />
          )}
          {changes.size > 0 && (
            <div className="admin-bar">
              <p>{fill(copy.changesCount, { n: changes.size })}</p>
              <div className="module-actions">
                <Button onClick={() => setChanges(new Map())}>{copy.discard}</Button>
                <Button type="primary" onClick={() => setReviewing(true)}>
                  {copy.save}
                </Button>
              </div>
            </div>
          )}
          <ActionDialog
            open={reviewing}
            title={copy.reviewChanges}
            onCancel={() => setReviewing(false)}
            cancelLabel={copy.keepEditing}
            confirmLabel={copy.saveChanges}
            loading={saving}
            onConfirm={() => void save()}
          >
            <ul>
              {changeList.map((change) => (
                <li key={keyOf(change.doctype, change.level, change.right)}>
                  {fill(copy.changeLine, {
                    doctype:
                      change.level > 0
                        ? `${change.doctype} (${copy.permlevel} ${change.level})`
                        : change.doctype,
                    right: copy[change.right],
                    before: change.after ? copy.off : copy.on,
                    after: change.after ? copy.on : copy.off,
                  })}
                </li>
              ))}
            </ul>
          </ActionDialog>
        </div>
      )}
    </AdminResource>
  );
}

/** Rol bölümü. Uç yoksa "Bu hizmet henüz bağlı değil." yazar. */
export default function RolesSection() {
  const env = useModule();
  const copy = useCopy();
  const admin = env?.client?.admin;
  if (!admin) return <Alert type="info" message={copy.unavailable} />;
  return <RoleMatrix admin={admin} />;
}
