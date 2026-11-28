import { theme } from 'antd';
import {
  CollectionButton as Button,
  CollectionInput as Input,
  CollectionSelect as Select,
} from './CollectionControls';
import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useSyncExternalStore,
  useId,
  useMemo,
  useState,
} from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { scopedKey } from '@/api/request-order';
import { CollectionState } from './CollectionState';
import { TableView } from './TableView';
import { collectionVariables, collectionViewOptions } from './collection-tokens';
import { createCollectionCache } from './query-cache';
import { readQuery, toListRequest, writeQuery } from './query';
import { toGroupSummaryRequest } from './summary';
import { useGroupSummary } from './use-group-summary';
import type {
  CollectionDefinition,
  CollectionQuery,
  CollectionSource,
  CollectionSummarySource,
  ViewType,
} from './types';
import './collection.css';

const heavyViews = {
  kanban: lazy(() => import('./views/KanbanView')),
  pivot: lazy(() => import('./views/PivotView')),
  report: lazy(() => import('./views/ReportView')),
  gantt: lazy(() => import('./views/GanttView')),
  timesheet: lazy(() => import('./views/TimesheetView')),
};
class ViewBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(_error: Error, _info: ErrorInfo) {
    /* Errors are presented without raw server or bundler details. */
  }
  override render() {
    return this.state.failed ? (
      <div role="alert">
        <p>Görünüm yüklenemedi.</p>
        <Button
          onClick={() => {
            window.location.reload();
          }}
        >
          Sayfayı yenile
        </Button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export interface CollectionViewProps {
  definition: CollectionDefinition;
  source: CollectionSource;
  mode?: 'dark' | 'light';
  /**
   * Gruplu sayım ve toplam kaynağı (`platform_core.api.collection.group_summary`).
   * Verilmezse Pivot ve Rapor yalnız gelen sayfayı özetler.
   */
  summarySource?: CollectionSummarySource | undefined;
  /**
   * Tablo dışındaki görünümleri açar. Varsayılan kapalıdır.
   * Tipli `group_summary` istemcisi `main` dalına gelene kadar ana uygulamada açılmaz.
   */
  enableExperimentalCollectionViews?: boolean;
  /**
   * Kaydın adresini verir. Verilirse tablodaki kayıt adı kayda giden bağlantı olur.
   * Adres sözleşmesi kabuğundur; görünüm adres üretmez.
   */
  recordHref?: ((name: string) => string) | undefined;
  /**
   * Open organisation (workspace) ID. A change discards every pending request and cached page
   * of the old organisation. A late response or error of the old organisation is not shown.
   */
  workspace?: string | undefined;
}
export function CollectionView({
  definition,
  source,
  mode = 'dark',
  summarySource,
  enableExperimentalCollectionViews = false,
  recordHref,
  workspace = '',
}: CollectionViewProps) {
  const [params, setParams] = useSearchParams();
  const requestedQuery = useMemo(() => readQuery(params, definition), [params, definition]);
  const query = useMemo(
    () =>
      enableExperimentalCollectionViews
        ? requestedQuery
        : { ...requestedQuery, view: 'table' as const },
    [requestedQuery, enableExperimentalCollectionViews],
  );
  const [draft, setDraft] = useState<{ search: string; base: string }>({
    search: query.search,
    base: query.search,
  });
  const search = draft.base === query.search ? draft.search : query.search;
  const request = useMemo(() => toListRequest(definition, query), [definition, query]);
  const key = scopedKey(workspace, JSON.stringify(request));
  const cache = useMemo(
    () => createCollectionCache({ source, definition, workspace }),
    [source, definition, workspace],
  );
  useEffect(() => () => cache.dispose(), [cache]);
  const subscribe = useCallback(
    (listener: () => void) => cache.subscribe(key, request, listener),
    [cache, key, request],
  );
  const snapshot = useCallback(() => cache.snapshot(key), [cache, key]);
  const current = useSyncExternalStore(subscribe, snapshot, () => undefined);
  const summaryRequest = useMemo(
    () =>
      query.view === 'pivot' || query.view === 'report'
        ? toGroupSummaryRequest(definition, query)
        : undefined,
    [definition, query],
  );
  const summary = useGroupSummary(summarySource, summaryRequest);
  const [selection, setSelection] = useState<{
    key: string;
    names: string[];
    source: CollectionSource;
    definition: CollectionDefinition;
  }>({
    key: '',
    names: [],
    source,
    definition,
  });
  const [inspect, setInspect] = useState(false);
  const { token } = theme.useToken();
  const titleId = useId();
  const contentId = useId();
  const page = current?.status === 'ready' ? current.page : undefined;
  const scope = key + query.view;
  const selected =
    selection.key === scope &&
    selection.source === source &&
    selection.definition === definition &&
    page
      ? selection.names.filter((name) => page.data.some((row) => row.name === name))
      : [];
  function update(patch: Partial<CollectionQuery>) {
    if (patch.search !== undefined) setDraft({ base: patch.search, search: patch.search });
    setParams(writeQuery(params, { ...query, page: 1, ...patch }));
    setInspect(false);
  }
  const HeavyView = query.view === 'table' ? undefined : heavyViews[query.view];
  const activeFilter = definition.columns.find((field) => field.fieldname === query.filter);
  const activeFilterValue =
    activeFilter?.choices.find((choice) => choice.value === query.value)?.label ?? query.value;
  const filterFields = definition.columns.filter(
    (field) => field.filterable && field.choices.length > 0,
  );
  return (
    <div className="collection" style={collectionVariables(token, mode)}>
      <section aria-labelledby={titleId}>
        <header className="collection-header">
          <div>
            <p className="collection-eyebrow">Kayıtlar</p>
            <h2 id={titleId}>{definition.label}</h2>
            {definition.sensitivity === 'restricted' && <p>Hassas kayıtlar</p>}
          </div>
        </header>
        {!enableExperimentalCollectionViews && requestedQuery.view !== 'table' && (
          <p role="status">İstenen görünüm şu anda kapalı. Tablo gösteriliyor.</p>
        )}
        <form
          role="search"
          className="collection-search"
          onSubmit={(event) => {
            event.preventDefault();
            update({ search });
          }}
        >
          <label className="collection-grow">
            <span>Kayıt ara</span>
            <Input
              aria-label="Kayıt ara"
              value={search}
              maxLength={200}
              onChange={(event) => {
                setDraft({ base: query.search, search: event.target.value });
              }}
            />
          </label>
          <Button htmlType="submit">Ara</Button>
        </form>
        <div className="collection-tools">
          <label>
            <span>Görünüm</span>
            <Select
              aria-label="Görünüm"
              value={query.view}
              options={
                enableExperimentalCollectionViews
                  ? collectionViewOptions
                  : collectionViewOptions.filter((option) => option.value === 'table')
              }
              onChange={(view: ViewType) => {
                update({ view, page: query.page });
              }}
            />
          </label>
          <label>
            <span>Sıralama alanı</span>
            <Select
              aria-label="Sıralama alanı"
              value={query.sort}
              options={definition.columns.map((field) => ({
                value: field.fieldname,
                label: field.label,
              }))}
              onChange={(sort: string) => {
                update({ sort });
              }}
            />
          </label>
          <label>
            <span>Sıralama yönü</span>
            <Select
              aria-label="Sıralama yönü"
              value={query.direction}
              options={[
                { value: 'asc', label: 'Artan' },
                { value: 'desc', label: 'Azalan' },
              ]}
              onChange={(direction: 'asc' | 'desc') => {
                update({ direction });
              }}
            />
          </label>
          {filterFields.map((field) => (
            <label key={field.fieldname}>
              <span>{field.label}</span>
              <Select
                aria-label={field.label}
                value={query.filter === field.fieldname ? query.value : ''}
                options={[{ value: '', label: 'Tümü' }, ...field.choices]}
                onChange={(value: string) => {
                  update({ filter: value ? field.fieldname : '', value });
                }}
              />
            </label>
          ))}
        </div>
        {(query.search || query.filter) && (
          <div className="collection-applied">
            <p>{query.search ? '"' + query.search + '" metni aranıyor.' : 'Arama metni yok.'}</p>
            <p>
              {activeFilter
                ? activeFilter.label + ' alanında "' + activeFilterValue + '" değeri aranıyor.'
                : 'Etkin süzgeç yok.'}
            </p>
            <Button
              onClick={() => {
                setDraft({ search: '', base: '' });
                update({ search: '', filter: '', value: '' });
              }}
            >
              Süzgeçleri temizle
            </Button>
          </div>
        )}
        {selected.length > 0 && query.view === 'table' && (
          <div role="toolbar" aria-label="Seçilen kayıtlar" className="collection-bulk">
            <strong>{selected.length} kayıt seçildi.</strong>
            <Button
              aria-expanded={inspect}
              aria-controls={contentId + '-selection'}
              onClick={() => {
                setInspect(!inspect);
              }}
            >
              Seçilenleri göster
            </Button>
            <Button
              onClick={() => {
                setSelection({ key: scope, names: [], source, definition });
                setInspect(false);
              }}
            >
              Seçimi kaldır
            </Button>
          </div>
        )}
        {inspect && selected.length > 0 && (
          <ul id={contentId + '-selection'}>
            {selected.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        )}
        <div id={contentId} role="region" aria-label="Koleksiyon içeriği" aria-busy={!current}>
          {!current ? (
            <CollectionState state="loading" />
          ) : current.status !== 'ready' ? (
            <CollectionState
              state={current.status}
              onRetry={() => {
                cache.retry(key);
              }}
            />
          ) : !page?.data.length ? (
            <CollectionState state="empty" />
          ) : (
            <ViewBoundary key={query.view}>
              <Suspense fallback={<CollectionState state="loading" />}>
                {HeavyView ? (
                  <HeavyView definition={definition} rows={page.data} summary={summary} />
                ) : (
                  <TableView
                    definition={definition}
                    rows={page.data}
                    recordHref={recordHref}
                    selected={selected}
                    onSelect={(names) => {
                      setSelection({ key: scope, names, source, definition });
                    }}
                  />
                )}
              </Suspense>
            </ViewBoundary>
          )}
        </div>
        <nav aria-label="Kayıt sayfaları" className="collection-pagination">
          <p>{query.page}. sayfa.</p>
          <div className="collection-page-actions">
            <Button
              disabled={query.page <= 1}
              onClick={() => {
                update({ page: query.page - 1 });
              }}
            >
              Önceki sayfa
            </Button>
            <Button
              disabled={!page?.hasNextPage}
              onClick={() => {
                update({ page: query.page + 1 });
              }}
            >
              Sonraki sayfa
            </Button>
          </div>
          <label>
            <span>Sayfadaki kayıt sayısı</span>
            <Select
              aria-label="Sayfadaki kayıt sayısı"
              value={query.size}
              options={[10, 20, 50].map((value) => ({ value, label: String(value) }))}
              onChange={(size: number) => {
                update({ size });
              }}
            />
          </label>
        </nav>
      </section>
    </div>
  );
}
