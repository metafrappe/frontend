/**
 * "Özelleştirme" sayfası (G-97 parça 2, AJA-2492).
 * Kiracı yöneticisi bir belge türüne alan ekler. Alanı yeniden adlandırır ya da gizler.
 * Kenar menüsündeki çalışma alanlarını düzenler.
 * Formları kayıt katmanı (`RecordView`) türün tanımından çizer. Bu sayfada elle form yoktur.
 * Sistem alanları değiştirilemez. Kural `model.ts` dosyasındadır.
 */
import { Alert, Button, Select, Tag } from 'antd';
import { useCallback, useId, useMemo, useRef, useState } from 'react';

import { RecordView, type RecordDataAdapter } from '@/views/record';

import { useModule } from '../context';
import { failureKind, useRead, type FailureKind } from '../data';
import { useCopy } from '../messages';
import { ModuleFrame, ResourceView, Section } from '../shared';
import type { CustomizationClient } from './client';
import { useCustomizationCopy, type CustomizationCopy } from './messages';
import {
  CUSTOM_FIELD_DOCTYPE,
  PROPERTY_SETTER_DOCTYPE,
  WORKSPACE_DOCTYPE,
  fieldRows,
  scopedCustomizationAdapter,
  setFieldHidden,
  type FieldRow,
} from './model';
import './customization.css';

type Panel =
  { kind: 'add' } | { kind: 'rename'; field: FieldRow } | { kind: 'workspace'; name: string };

type Notice =
  { kind: 'done'; text: keyof CustomizationCopy } | { kind: 'error'; error: FailureKind };

/** İstemci ayrı parçadadır. Yalnız bu sayfa açılınca iner. */
function useCustomizationClient() {
  const load = useModule()?.client?.customization;
  const read = useCallback(async () => {
    if (!load) throw new Error('unavailable');
    return load();
  }, [load]);
  return useRead<CustomizationClient>(load ? read : null, 'customization-client');
}

/** Odağı açan düğmeye geri verir. Düğme artık yoksa odak yerinde kalır. */
function useReturnFocus() {
  const opener = useRef<HTMLElement | null>(null);
  const remember = () => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  };
  const restore = () => {
    const target = opener.current;
    requestAnimationFrame(() => {
      if (target?.isConnected) target.focus();
    });
  };
  return { remember, restore };
}

function FormPanel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const c = useCustomizationCopy();
  return (
    <section className="module-stack module-review customization-panel" aria-label={title}>
      <div className="module-actions">
        <Button onClick={onClose}>{c.closeForm}</Button>
      </div>
      {children}
    </section>
  );
}

function FieldList({
  rows,
  busy,
  onRename,
  onToggle,
}: {
  rows: FieldRow[];
  busy: string | undefined;
  onRename: (row: FieldRow) => void;
  onToggle: (row: FieldRow) => void;
}) {
  const c = useCustomizationCopy();
  if (rows.length === 0) return <p>{c.noFields}</p>;
  return (
    <ul className="module-records" aria-label={c.fields}>
      {rows.map((row) => (
        <li className="module-record customization-row" key={row.fieldname}>
          <div>
            <p className="customization-label">{row.label}</p>
            <p className="customization-meta">
              <code>{row.fieldname}</code> {row.fieldtype}
            </p>
            {row.hidden && <Tag>{c.hiddenTag}</Tag>}
            {row.system && <p className="customization-meta">{c.system}</p>}
          </div>
          {!row.system && (
            <div className="module-actions">
              <Button onClick={() => onRename(row)} disabled={busy !== undefined}>
                {c.rename}
              </Button>
              <Button
                onClick={() => onToggle(row)}
                loading={busy === row.fieldname}
                disabled={busy !== undefined && busy !== row.fieldname}
              >
                {row.hidden ? c.show : c.hide}
              </Button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function DoctypeFields({
  client,
  doctype,
  revision,
  setNotice,
  changed,
}: {
  client: CustomizationClient;
  doctype: string;
  revision: number;
  setNotice: (notice: Notice) => void;
  changed: () => void;
}) {
  const c = useCustomizationCopy();
  const locale = useModule()?.locale ?? 'tr';
  // Her değişiklikten sonra yeni bağdaştırıcı kurulur. Tür tanımı önbelleği boş başlar.
  const base = useMemo(() => {
    void revision;
    return client.createAdapter();
  }, [client, revision]);
  const load = useCallback(
    async (signal: AbortSignal) => {
      const [meta, custom] = await Promise.all([
        base.getDocTypeMeta({ doctype, language: locale, signal }),
        client.listCustomFieldnames(doctype, { signal }),
      ]);
      return { rows: fieldRows(meta, custom), custom };
    },
    [base, client, doctype, locale],
  );
  const read = useRead(load, `${doctype}:${revision}`);
  const [panel, setPanel] = useState<Panel>();
  const [busy, setBusy] = useState<string>();
  const focus = useReturnFocus();
  const ready = read.state.status === 'ready' ? read.state.data : undefined;
  const protectedFields = useMemo(
    () => new Set(ready?.rows.filter((row) => row.system).map((row) => row.fieldname) ?? []),
    [ready],
  );
  const renameField = panel?.kind === 'rename' ? panel.field.fieldname : undefined;
  const adapter: RecordDataAdapter = useMemo(
    () =>
      scopedCustomizationAdapter(base, {
        doctype,
        field: renameField,
        protectedFields,
        valueLabel: c.newName,
      }),
    [base, doctype, renameField, protectedFields, c.newName],
  );

  const close = () => {
    setPanel(undefined);
    focus.restore();
  };
  const saved = (text: keyof CustomizationCopy) => {
    setNotice({ kind: 'done', text });
    close();
    changed();
  };
  async function toggle(row: FieldRow) {
    setBusy(row.fieldname);
    try {
      await setFieldHidden(adapter, doctype, row.fieldname, !row.hidden);
      setNotice({ kind: 'done', text: row.hidden ? 'shownDone' : 'hiddenDone' });
      changed();
    } catch (error) {
      setNotice({ kind: 'error', error: failureKind(error, true) });
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <Section title={c.fields}>
      {!panel && (
        <div className="module-actions">
          <Button
            type="primary"
            onClick={() => {
              focus.remember();
              setPanel({ kind: 'add' });
            }}
          >
            {c.addField}
          </Button>
        </div>
      )}
      {panel?.kind === 'add' && (
        <FormPanel title={c.newField} onClose={close}>
          <RecordView
            doctype={CUSTOM_FIELD_DOCTYPE}
            createMode
            title={c.newField}
            saveActionLabel={c.saveField}
            adapter={adapter}
            locale={locale}
            onSaved={() => saved('fieldAdded')}
          />
        </FormPanel>
      )}
      {panel?.kind === 'rename' && (
        <FormPanel title={c.renameTitle} onClose={close}>
          <RecordView
            key={panel.field.fieldname}
            doctype={PROPERTY_SETTER_DOCTYPE}
            createMode
            title={c.renameTitle}
            saveActionLabel={c.saveName}
            adapter={adapter}
            locale={locale}
            onSaved={() => saved('renamed')}
          />
        </FormPanel>
      )}
      <ResourceView state={read.state} retry={read.refresh}>
        {(data) => (
          <FieldList
            rows={data.rows}
            busy={busy}
            onRename={(field) => {
              focus.remember();
              setPanel({ kind: 'rename', field });
            }}
            onToggle={(row) => void toggle(row)}
          />
        )}
      </ResourceView>
    </Section>
  );
}

function SideMenu({
  client,
  setNotice,
}: {
  client: CustomizationClient;
  setNotice: (notice: Notice) => void;
}) {
  const c = useCustomizationCopy();
  const locale = useModule()?.locale ?? 'tr';
  const [revision, setRevision] = useState(0);
  const load = useCallback(
    async (signal: AbortSignal) => {
      void revision;
      return client.listWorkspaces({ signal });
    },
    [client, revision],
  );
  const read = useRead(load, `workspaces:${revision}`);
  const [editing, setEditing] = useState<string>();
  const adapter = useMemo(() => {
    void revision;
    return client.createAdapter();
  }, [client, revision]);
  const focus = useReturnFocus();
  const close = () => {
    setEditing(undefined);
    focus.restore();
  };
  return (
    <Section title={c.menu}>
      {editing && (
        <FormPanel title={editing} onClose={close}>
          <RecordView
            key={editing}
            doctype={WORKSPACE_DOCTYPE}
            name={editing}
            saveActionLabel={c.saveMenu}
            adapter={adapter}
            locale={locale}
            onSaved={() => {
              setNotice({ kind: 'done', text: 'menuSaved' });
              close();
              setRevision((value) => value + 1);
            }}
          />
        </FormPanel>
      )}
      <ResourceView state={read.state} retry={read.refresh}>
        {(rows) =>
          rows.length === 0 ? (
            <p>{c.noWorkspaces}</p>
          ) : (
            <ul className="module-records" aria-label={c.workspaces}>
              {rows.map((row) => (
                <li className="module-record customization-row" key={row.name}>
                  <div>
                    <p className="customization-label">{row.title}</p>
                    {row.hidden && <Tag>{c.hiddenTag}</Tag>}
                  </div>
                  <Button
                    disabled={editing !== undefined}
                    onClick={() => {
                      focus.remember();
                      setEditing(row.name);
                    }}
                  >
                    {c.edit}
                  </Button>
                </li>
              ))}
            </ul>
          )
        }
      </ResourceView>
    </Section>
  );
}

function NoticeLine({ notice }: { notice: Notice | undefined }) {
  const c = useCustomizationCopy();
  const copy = useCopy();
  return (
    <>
      <p role="status" className="customization-status">
        {notice?.kind === 'done' ? c[notice.text] : ''}
      </p>
      {notice?.kind === 'error' && <Alert role="alert" type="error" message={copy[notice.error]} />}
    </>
  );
}

export default function CustomizationPage() {
  const c = useCustomizationCopy();
  const id = useId();
  const clientRead = useCustomizationClient();
  const client = clientRead.state.status === 'ready' ? clientRead.state.data : undefined;
  const doctypesLoad = useCallback(
    async (signal: AbortSignal) => (client ? client.listDocTypes({ signal }) : []),
    [client],
  );
  const doctypes = useRead(client ? doctypesLoad : null, 'doctypes');
  const [doctype, setDoctype] = useState<string>();
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState<Notice>();

  return (
    <ModuleFrame title={c.title}>
      <p>{c.intro}</p>
      <NoticeLine notice={notice} />
      <ResourceView state={clientRead.state} retry={clientRead.refresh}>
        {(ready) => (
          <>
            <Section title={c.pickTitle}>
              <ResourceView state={doctypes.state} retry={doctypes.refresh}>
                {(names) => (
                  <div className="module-stack customization-picker">
                    <label htmlFor={`${id}-doctype`}>{c.doctype}</label>
                    <Select<string>
                      id={`${id}-doctype`}
                      value={doctype ?? null}
                      placeholder={c.chooseDoctype}
                      showSearch
                      options={names.map((name) => ({ value: name, label: name }))}
                      onChange={(value) => {
                        // Belge türü değişince eski bildirim kalkar.
                        setNotice(undefined);
                        setDoctype(value);
                      }}
                    />
                  </div>
                )}
              </ResourceView>
            </Section>
            {doctype ? (
              <DoctypeFields
                key={doctype}
                client={ready}
                doctype={doctype}
                revision={revision}
                setNotice={setNotice}
                changed={() => setRevision((value) => value + 1)}
              />
            ) : (
              <p>{c.chooseDoctype}</p>
            )}
            <SideMenu client={ready} setNotice={setNotice} />
          </>
        )}
      </ResourceView>
    </ModuleFrame>
  );
}
