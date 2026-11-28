// "Veri aktarımı" sayfası (G-97 parça 3, AJA-2493).
//
// Üç bölüm vardır:
// 1. İçe aktar: şablon, dosya yükleme, sütun eşleme, aktarımı başlatma ve hata raporu.
//    İş Frappe'nin `Data Import` belgesiyle yapılır.
// 2. Dışa aktar: liste CSV olarak iner. Yalnız sunucunun okunabilir dediği alanlar yazılır.
// 3. Kişisel verilerim: KVKK kişisel veri indirme talebi (`Personal Data Download Request`).
//
// Sahte ilerleme yoktur. Aktarım sonucu yalnız kullanıcı "Sonucu göster" deyince okunur.
import { Alert, Button, Select } from 'antd';
import { useId, useMemo, useState } from 'react';
import { useModule } from '../context';
import { failureKind, useMutation, useRead, type FailureKind } from '../data';
import { useCopy } from '../messages';
import type { DataTransferClient } from '../runtime';
import { ModuleFrame, ResourceView, Section } from '../shared';
import { fileName, saveTextFile } from './download';
import { useDataTransferCopy } from './messages';
import {
  SKIP_COLUMN,
  exportColumns,
  templateColumns,
  toCsv,
  type DataColumn,
  type ImportFailure,
  type ImportPreview,
  type ImportStatus,
} from './model';
import './data-transfer.css';

/** Sayfa istemcisini tembel yükler. İstemci yoksa (örnek kip dışı) `null` döner. */
function useClient(): (() => Promise<DataTransferClient>) | null {
  return useModule()?.client?.dataTransfer ?? null;
}

function useDoctypes(purpose: 'import' | 'export') {
  const client = useClient();
  const load = useMemo(
    () =>
      client
        ? async (signal: AbortSignal) => (await client()).listDoctypes(purpose, { signal })
        : null,
    [client, purpose],
  );
  return useRead(load, `doctypes:${purpose}`);
}

function Failure({ error }: { error: FailureKind }) {
  const copy = useCopy();
  return <Alert role="alert" type="error" message={copy[error]} />;
}

function DoctypeSelect({
  label,
  doctypes,
  value,
  onChange,
}: {
  label: string;
  doctypes: string[];
  value: string | undefined;
  onChange: (doctype: string) => void;
}) {
  const t = useDataTransferCopy();
  const id = useId();
  if (doctypes.length === 0) return <Alert type="info" message={t.noDoctypes} />;
  return (
    <div className="data-transfer-field">
      <label htmlFor={id}>{label}</label>
      <Select
        id={id}
        {...(value ? { value } : {})}
        placeholder={t.doctypePlaceholder}
        options={doctypes.map((doctype) => ({ value: doctype, label: doctype }))}
        onChange={onChange}
        showSearch
      />
    </div>
  );
}

type Busy = 'template' | 'upload' | 'start' | 'result' | null;
interface Prepared {
  name: string;
  preview: ImportPreview;
  fields: DataColumn[];
}

const STATUS_KEYS: Record<ImportStatus, keyof ReturnType<typeof useDataTransferCopy>> = {
  Pending: 'statusPending',
  Success: 'statusSuccess',
  'Partial Success': 'statusPartial',
  Error: 'statusError',
  'Timed Out': 'statusTimedOut',
};

function ImportSection() {
  const t = useDataTransferCopy();
  const client = useClient();
  const { state, refresh } = useDoctypes('import');
  const fileId = useId();
  const [doctype, setDoctype] = useState<string>();
  const [file, setFile] = useState<File>();
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<FailureKind>();
  const [prepared, setPrepared] = useState<Prepared>();
  const [mapping, setMapping] = useState<Record<number, string | null>>({});
  const [started, setStarted] = useState(false);
  const [result, setResult] = useState<{ status: ImportStatus; failures: ImportFailure[] }>();

  async function act(
    kind: Exclude<Busy, null>,
    writing: boolean,
    work: (api: DataTransferClient) => Promise<void>,
  ) {
    if (busy || !client) return;
    setBusy(kind);
    setError(undefined);
    try {
      await work(await client());
    } catch (failure) {
      setError(failureKind(failure, writing));
    } finally {
      setBusy(null);
    }
  }

  function chooseDoctype(next: string) {
    setDoctype(next);
    setPrepared(undefined);
    setStarted(false);
    setResult(undefined);
    setError(undefined);
  }

  const downloadTemplate = (type: string) =>
    act('template', false, async (api) => {
      const meta = await api.getMeta(type, {});
      saveTextFile(fileName(type, '-sablon'), toCsv(templateColumns(meta), []));
    });

  const upload = (type: string, chosen: File) =>
    act('upload', true, async (api) => {
      const [meta, next] = await Promise.all([
        api.getMeta(type, {}),
        api.prepareImport(type, chosen, {}),
      ]);
      setPrepared({ ...next, fields: templateColumns(meta) });
      setMapping(
        Object.fromEntries(next.preview.columns.map((column) => [column.index, column.field])),
      );
      setStarted(false);
      setResult(undefined);
    });

  const start = (name: string) =>
    act('start', true, async (api) => {
      await api.startImport(name, mapping, {});
      setStarted(true);
    });

  const showResult = (name: string) =>
    act('result', false, async (api) => {
      setResult(await api.importResult(name, {}));
    });

  return (
    <Section title={t.importTitle}>
      <ResourceView state={state} retry={refresh}>
        {(doctypes) => (
          <div className="module-stack">
            <DoctypeSelect
              label={t.importDoctype}
              doctypes={doctypes}
              value={doctype}
              onChange={chooseDoctype}
            />
            {doctype && (
              <>
                <p>{t.templateNote}</p>
                <div className="module-actions">
                  <Button
                    loading={busy === 'template'}
                    onClick={() => void downloadTemplate(doctype)}
                  >
                    {busy === 'template' ? t.reading : t.template}
                  </Button>
                </div>
                <div className="data-transfer-field">
                  <label htmlFor={fileId}>{t.file}</label>
                  <p id={`${fileId}-note`}>{t.fileNote}</p>
                  <input
                    id={fileId}
                    type="file"
                    className="data-transfer-file"
                    accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                    aria-describedby={`${fileId}-note`}
                    onChange={(event) => {
                      setFile(event.target.files?.[0]);
                      setPrepared(undefined);
                      setStarted(false);
                      setResult(undefined);
                    }}
                  />
                </div>
                <div className="module-actions">
                  <Button
                    type="primary"
                    disabled={!file}
                    loading={busy === 'upload'}
                    onClick={() => file && void upload(doctype, file)}
                  >
                    {busy === 'upload' ? t.uploading : t.upload}
                  </Button>
                </div>
              </>
            )}
            {error && <Failure error={error} />}
            {prepared && (
              <MappingForm
                prepared={prepared}
                mapping={mapping}
                locked={started}
                onChange={(index, field) =>
                  setMapping((current) => ({ ...current, [index]: field }))
                }
              />
            )}
            {prepared && !started && (
              <div className="module-actions">
                <Button
                  type="primary"
                  loading={busy === 'start'}
                  onClick={() => void start(prepared.name)}
                >
                  {busy === 'start' ? t.starting : t.start}
                </Button>
              </div>
            )}
            {started && (
              <div className="module-stack">
                <div role="status">
                  <Alert type="info" message={t.started} />
                </div>
                <div className="module-actions">
                  <Button
                    loading={busy === 'result'}
                    onClick={() => prepared && void showResult(prepared.name)}
                  >
                    {busy === 'result' ? t.reading : t.result}
                  </Button>
                </div>
              </div>
            )}
            {result && <ImportReport result={result} />}
          </div>
        )}
      </ResourceView>
    </Section>
  );
}

function MappingForm({
  prepared,
  mapping,
  locked,
  onChange,
}: {
  prepared: Prepared;
  mapping: Record<number, string | null>;
  locked: boolean;
  onChange: (index: number, field: string | null) => void;
}) {
  const t = useDataTransferCopy();
  const id = useId();
  const options = [
    { value: SKIP_COLUMN, label: t.skip },
    ...prepared.fields.map((field) => ({ value: field.fieldname, label: field.label })),
  ];
  const labelOf = (value: string) =>
    options.find((option) => option.value === value)?.label ?? value;
  return (
    <section className="module-stack" aria-label={t.mapping}>
      <h3>{t.mapping}</h3>
      <p>{t.rowCount(prepared.preview.rows)}</p>
      <p>{t.mappingNote}</p>
      {locked ? (
        // Aktarım başlayınca eşleme değişmez. Seçim kutusu yerine okunur metin görünür.
        <dl className="module-records">
          {prepared.preview.columns.map((column) => (
            <div key={column.index} className="data-transfer-field">
              <dt>{t.columnField(column.header)}</dt>
              <dd>{labelOf(mapping[column.index] ?? SKIP_COLUMN)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <ul className="module-records">
          {prepared.preview.columns.map((column) => (
            <li key={column.index} className="data-transfer-field">
              <label htmlFor={`${id}-${column.index}`}>{t.columnField(column.header)}</label>
              <Select
                id={`${id}-${column.index}`}
                value={mapping[column.index] ?? SKIP_COLUMN}
                options={options}
                onChange={(value: string) =>
                  onChange(column.index, value === SKIP_COLUMN ? null : value)
                }
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ImportReport({ result }: { result: { status: ImportStatus; failures: ImportFailure[] } }) {
  const t = useDataTransferCopy();
  const message = t[STATUS_KEYS[result.status]] as string;
  const type =
    result.status === 'Success' ? 'success' : result.status === 'Pending' ? 'info' : 'warning';
  return (
    <div className="module-stack">
      <div role="status">
        <Alert type={type} message={message} />
      </div>
      {result.failures.length > 0 && (
        <ul className="module-records data-transfer-report" aria-label={t.errorReport}>
          {result.failures.map((failure, index) => (
            <li key={index}>
              {t.failedRow(failure.rows, failure.messages.join(' ') || t.noMessage)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ExportSection() {
  const t = useDataTransferCopy();
  const client = useClient();
  const { state, refresh } = useDoctypes('export');
  const [doctype, setDoctype] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<
    { kind: 'done'; rows: number; truncated: boolean } | { kind: 'error'; error: FailureKind }
  >();

  async function run() {
    if (busy || !client || !doctype) return;
    setBusy(true);
    setOutcome(undefined);
    try {
      const api = await client();
      const columns = exportColumns(await api.getMeta(doctype, {}));
      const { rows, truncated } = await api.listRows(
        doctype,
        columns.map((column) => column.fieldname),
        {},
      );
      saveTextFile(fileName(doctype), toCsv(columns, rows));
      setOutcome({ kind: 'done', rows: rows.length, truncated });
    } catch (error) {
      setOutcome({ kind: 'error', error: failureKind(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title={t.exportTitle}>
      <ResourceView state={state} retry={refresh}>
        {(doctypes) => (
          <div className="module-stack">
            <p>{t.exportNote}</p>
            <DoctypeSelect
              label={t.exportDoctype}
              doctypes={doctypes}
              value={doctype}
              onChange={(next) => {
                setDoctype(next);
                setOutcome(undefined);
              }}
            />
            {doctype && (
              <div className="module-actions">
                <Button type="primary" loading={busy} onClick={() => void run()}>
                  {busy ? t.exporting : t.exportButton}
                </Button>
              </div>
            )}
            {outcome?.kind === 'error' && <Failure error={outcome.error} />}
            {outcome?.kind === 'done' && (
              <div role="status">
                <Alert
                  type={outcome.truncated ? 'warning' : 'success'}
                  message={
                    outcome.truncated ? t.exportTruncated(outcome.rows) : t.exported(outcome.rows)
                  }
                />
              </div>
            )}
          </div>
        )}
      </ResourceView>
    </Section>
  );
}

function PersonalDataSection() {
  const t = useDataTransferCopy();
  const copy = useCopy();
  const env = useModule();
  const client = useClient();
  const { state, run } = useMutation();
  if (!client || !env) return null;
  const done = state.status === 'success';
  const pending = state.status === 'pending';
  return (
    <Section title={t.personalTitle}>
      <p>{t.personalNote}</p>
      <div className="module-actions">
        <Button
          type="primary"
          disabled={done}
          loading={pending}
          onClick={() =>
            void run(async (signal) => (await client()).requestPersonalData(env.user, { signal }))
          }
        >
          {pending ? t.personalSending : t.personalButton}
        </Button>
      </div>
      {done && (
        <div role="status">
          <Alert type="success" message={t.personalDone} />
        </div>
      )}
      {state.status === 'error' && <Alert role="alert" type="error" message={copy[state.error]} />}
    </Section>
  );
}

export default function DataTransferPage() {
  const t = useDataTransferCopy();
  return (
    <ModuleFrame title={t.title}>
      <p>{t.intro}</p>
      <ImportSection />
      <ExportSection />
      <PersonalDataSection />
    </ModuleFrame>
  );
}
