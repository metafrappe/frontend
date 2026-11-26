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
  useSyncExternalStore,
  useId,
  useMemo,
  useState,
} from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BulkActions } from './BulkActions';
import { CollectionState } from './CollectionState';
import { TableView } from './TableView';
import { collectionVariables, collectionViewOptions } from './collection-tokens';
import { createCollectionCache } from './query-cache';
import { applySavedView, isSavedViewActive, readQuery, toListRequest, writeQuery } from './query';
import { toGroupSummaryRequest } from './summary';
import { useGroupSummary } from './use-group-summary';
import type {
  CollectionDefinition,
  CollectionQuery,
  CollectionSource,
  CollectionSummarySource,
  SavedView,
  ViewType,
} from './types';
import './collection.css';

/** Kayıtlı görünüm verilmezse liste yalnız "Tümü" görünümünü sunar. */
const allRecordsView: readonly SavedView[] = [{ id: 'tumu', label: 'Tümü', query: {} }];
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
   * Kayıtlı görünümler. Örnek: "Bekleyenler", "Bu ay" ve "Tümü".
   * Seçilen görünüm adreste `saved` alanında tutulur.
   */
  savedViews?: readonly SavedView[] | undefined;
}
export function CollectionView({
  definition,
  source,
  mode = 'dark',
  summarySource,
  enableExperimentalCollectionViews = false,
  recordHref,
  savedViews = allRecordsView,
}: CollectionViewProps) {
  const [params, setParams] = useSearchParams();
  const requestedQuery = useMemo(
    () => readQuery(params, definition, savedViews),
    [params, definition, savedViews],
  );
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
  const key = JSON.stringify(request);
  const cache = useMemo(() => createCollectionCache({ source, definition }), [source, definition]);
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
  // "Seç" düğmesi seçim kipini açar. Kip kapalıyken satırlarda seçim kutusu yoktur.
  const [selecting, setSelecting] = useState(false);
  const { token } = theme.useToken();
  const titleId = useId();
  const contentId = useId();
  const selectId = useId();
  const page = current?.status === 'ready' ? current.page : undefined;
  const scope = key + query.view;
  const selected =
    selection.key === scope &&
    selection.source === source &&
    selection.definition === definition &&
    page
      ? selection.names.filter((name) => page.data.some((row) => row.name === name))
      : [];
  function navigate(next: CollectionQuery) {
    setDraft({ base: next.search, search: next.search });
    setParams(writeQuery(params, next));
  }
  function update(patch: Partial<CollectionQuery>) {
    // Kullanıcı süzgeci, aramayı ya da sıralamayı elle değiştirirse kayıtlı görünüm seçimi kalkar.
    const custom = ['search', 'sort', 'direction', 'filter', 'value'].some(
      (field) => field in patch,
    );
    navigate({ ...query, page: 1, ...(custom ? { saved: '' } : {}), ...patch });
  }
  const HeavyView = query.view === 'table' ? undefined : heavyViews[query.view];
  const activeFilter = definition.columns.find((field) => field.fieldname === query.filter);
  const activeFilterValue =
    activeFilter?.choices.find((choice) => choice.value === query.value)?.label ?? query.value;
  const activeTags = [
    ...(query.search
      ? [
          {
            key: 'search',
            label: 'Arama: ' + query.search,
            remove: 'Aramayı kaldır',
            patch: { search: '' },
          },
        ]
      : []),
    ...(activeFilter && query.value
      ? [
          {
            key: 'filter',
            label: activeFilter.label + ': ' + activeFilterValue,
            remove: activeFilter.label + ' süzgecini kaldır',
            patch: { filter: '', value: '' },
          },
        ]
      : []),
  ];
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
        <div className="collection-viewbar" data-collection-part="views">
          <fieldset className="collection-saved">
            <legend className="collection-sr-only">Kayıtlı görünüm</legend>
            {savedViews.map((view) => (
              <label key={view.id} className="collection-saved-option">
                <input
                  type="radio"
                  name={titleId + '-saved'}
                  value={view.id}
                  checked={isSavedViewActive(query, view)}
                  onChange={() => {
                    navigate(applySavedView(query, view));
                  }}
                />
                <span>{view.label}</span>
              </label>
            ))}
          </fieldset>
          <label className="collection-view-type">
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
          {query.view === 'table' && (
            <Button
              id={selectId}
              aria-pressed={selecting}
              onClick={() => {
                // Kip kapanınca seçim de kalkar.
                if (selecting) setSelection({ key: scope, names: [], source, definition });
                setSelecting(!selecting);
              }}
            >
              Seç
            </Button>
          )}
          {!enableExperimentalCollectionViews && requestedQuery.view !== 'table' && (
            <p role="status">İstenen görünüm şu anda kapalı. Tablo gösteriliyor.</p>
          )}
        </div>
        <div className="collection-filterbar" data-collection-part="filters">
          <div className="collection-applied">
            <p role="status" className="collection-filter-count">
              {activeTags.length ? activeTags.length + ' süzgeç etkin' : 'Etkin süzgeç yok.'}
            </p>
            {activeTags.length > 0 && (
              <>
                <ul aria-label="Etkin süzgeçler" className="collection-tags">
                  {activeTags.map((tag) => (
                    <li key={tag.key} className="collection-tag">
                      <span>{tag.label}</span>
                      <Button
                        aria-label={tag.remove}
                        onClick={() => {
                          update(tag.patch);
                        }}
                      >
                        Kaldır
                      </Button>
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => {
                    update({ search: '', filter: '', value: '' });
                  }}
                >
                  Süzgeçleri temizle
                </Button>
              </>
            )}
          </div>
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
        </div>
        <div className="collection-bulk-slot" data-collection-part="bulk">
          {selecting && query.view === 'table' && (
            <BulkActions
              selected={selected}
              onClear={() => {
                setSelection({ key: scope, names: [], source, definition });
                document.getElementById(selectId)?.focus();
              }}
            />
          )}
        </div>
        <div
          id={contentId}
          role="region"
          aria-label="Koleksiyon içeriği"
          aria-busy={!current}
          data-collection-part="table"
        >
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
                    selecting={selecting}
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
