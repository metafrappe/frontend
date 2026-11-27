import {
  ArrowClockwise,
  CaretLeft,
  CaretRight,
  CheckCircle,
  DotsThree,
  Export,
  Funnel,
  MagnifyingGlass,
  Plus,
  Trash,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import { Button, Dropdown, Input, Segmented, Select, Tag } from 'antd';
import { Fragment, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { useFormat } from '@/app/locale';

import { t } from '../messages';
import type { ViewType } from '../tokens';
import { shellTokens } from '../tokens';
import { viewIcons } from './viewIcons';

export type HeaderState =
  | { kind: 'none' }
  | { kind: 'normal'; syncedAt: string }
  | { kind: 'live'; secondsAgo: number }
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'error'; message: string; onRetry: () => void }
  | { kind: 'selection'; count: number; onClear: () => void }
  | { kind: 'dirty'; changes: number; onDiscard: () => void; onSave: () => void };

export interface Crumb {
  label: string;
  to?: string;
}

export interface HeaderAction {
  label: string;
  onClick: () => void;
}

export interface PageHeaderProps {
  title: string;
  crumbs: Crumb[];
  count?: number;
  view: ViewType;
  onViewChange: (v: ViewType) => void;
  state: HeaderState;
  primaryAction?: HeaderAction;
  secondaryActions?: HeaderAction[];
  /** Record navigator in the form view. */
  record?: { index: number; total: number; onPrev?: () => void; onNext?: () => void };
  search?: string;
  onSearchChange?: (q: string) => void;
  filters?: { key: string; label: string }[];
  onRemoveFilter?: (key: string) => void;
  onClearFilters?: () => void;
  savedViews?: { value: string; label: string }[];
  savedView?: string;
  onSavedViewChange?: (v: string) => void;
  /** Search, filter and view-type bar. On by default. The home page does not render the bar. */
  tools?: boolean;
}

/**
 * Page header. Default variant is "with toolbar" (HD1–HD6, VT1–VT3).
 * Every page uses this component. Content is filled from data.
 */
export function PageHeader(p: PageHeaderProps) {
  const { state } = p;
  const format = useFormat();
  const isForm = p.view === 'form';
  const headerRef = useRef<HTMLElement>(null);
  const [stuck, setStuck] = useState(false);

  // HD6: a bottom shadow appears when content scrolls. On wide screens content
  // scrolls inside `.shell-body`, the header's sibling.
  useEffect(() => {
    const body = headerRef.current?.parentElement?.querySelector('.shell-body');
    if (!body) return undefined;
    const onScroll = () => setStuck(body.scrollTop > 0);
    onScroll();
    body.addEventListener('scroll', onScroll, { passive: true });
    return () => body.removeEventListener('scroll', onScroll);
  }, []);

  const busy = state.kind === 'loading';

  return (
    <>
      <header
        ref={headerRef}
        className="shell-hd"
        data-stuck={stuck ? 'true' : 'false'}
        data-state={state.kind}
        aria-busy={busy}
      >
        <nav aria-label={t.header.crumbs} className="shell-hd-crumbs">
          <ol>
            {p.crumbs.map((c, i) => {
              const last = i === p.crumbs.length - 1;
              return (
                <li key={`${c.label}-${i}`}>
                  {c.to && !last ? (
                    <Link to={c.to}>{c.label}</Link>
                  ) : (
                    <span {...(last ? { 'aria-current': 'page' as const } : {})}>{c.label}</span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="shell-hd-row">
          <div className="shell-hd-main">
            <div className="shell-hd-titlerow">
              <h1 className="shell-hd-title">{p.title}</h1>
              {p.count !== undefined && !isForm && (
                <span className="shell-hd-count">
                  {busy ? (
                    <span className="shell-skel" aria-hidden="true" />
                  ) : (
                    format.number(p.count)
                  )}
                </span>
              )}
            </div>
            <StateLine state={state} />
          </div>
          <Actions {...p} />
        </div>

        {state.kind === 'error' && (
          <div className="shell-hd-err" role="alert">
            <WarningCircle aria-hidden="true" />
            <span>{state.message}</span>
            <Button
              size="small"
              icon={<ArrowClockwise aria-hidden="true" />}
              onClick={state.onRetry}
            >
              {t.header.state.retry}
            </Button>
          </div>
        )}

        {p.tools !== false && <Toolbar {...p} />}
      </header>
    </>
  );
}

function StateLine({ state }: { state: HeaderState }) {
  const s = t.header.state;
  const format = useFormat();
  // Without a status line, an empty "no records" text is not written. The page explains its state in the body itself.
  if (state.kind === 'none') return null;
  let body: React.ReactNode;
  switch (state.kind) {
    case 'normal':
      body = (
        <>
          <CheckCircle aria-hidden="true" />
          <span className="shell-vh">{s.normal(state.syncedAt)}</span>
          <span aria-hidden="true">
            {s.normalShort} · {state.syncedAt}
          </span>
        </>
      );
      break;
    case 'live':
      body = (
        <>
          <span className="shell-pulse" aria-hidden="true" />
          <span>{s.live(state.secondsAgo)}</span>
        </>
      );
      break;
    case 'loading':
      body = (
        <>
          <ArrowClockwise className="shell-spin" aria-hidden="true" />
          <span>{s.loading}</span>
        </>
      );
      break;
    case 'empty':
      body = <span>{s.empty}</span>;
      break;
    case 'error':
      body = (
        <>
          <WarningCircle aria-hidden="true" />
          <span>{s.error}</span>
        </>
      );
      break;
    case 'selection':
      body = <span>{s.selection(format.number(state.count))}</span>;
      break;
    case 'dirty':
      body = (
        <>
          <span className="shell-dot" aria-hidden="true" />
          <span>{s.dirty(format.number(state.changes))}</span>
        </>
      );
      break;
  }
  return (
    <p className="shell-hd-sync" role="status" data-kind={state.kind}>
      {body}
    </p>
  );
}

function Actions(p: PageHeaderProps) {
  const { state } = p;
  const s = t.header.state;

  if (state.kind === 'selection') {
    return (
      <div className="shell-hd-act" data-kind="bulk">
        <Button icon={<Export aria-hidden="true" />}>{s.bulkExport}</Button>
        <Button danger icon={<Trash aria-hidden="true" />}>
          {s.bulkDelete}
        </Button>
        <Button
          type="text"
          aria-label={s.clearSelection}
          icon={<X aria-hidden="true" />}
          onClick={state.onClear}
        />
      </div>
    );
  }

  if (state.kind === 'dirty') {
    return (
      <div className="shell-hd-act" data-kind="dirty">
        <Button onClick={state.onDiscard}>{s.discard}</Button>
        <Button type="primary" onClick={state.onSave}>
          {s.save}
        </Button>
      </div>
    );
  }

  const more = p.secondaryActions ?? [];
  return (
    <div className="shell-hd-act">
      {more.length > 0 && (
        <Dropdown
          trigger={['click']}
          menu={{
            items: more.map((a) => ({ key: a.label, label: a.label, onClick: a.onClick })),
          }}
        >
          <Button aria-label={t.header.more} icon={<DotsThree aria-hidden="true" />} />
        </Dropdown>
      )}
      {p.primaryAction && (
        <Button
          type="primary"
          icon={<Plus aria-hidden="true" />}
          onClick={p.primaryAction.onClick}
          disabled={state.kind === 'loading'}
        >
          {p.primaryAction.label}
        </Button>
      )}
    </div>
  );
}

function Toolbar(p: PageHeaderProps) {
  const isForm = p.view === 'form';
  const format = useFormat();
  const filters = p.filters ?? [];
  return (
    <div className="shell-hd-tools">
      {isForm ? (
        p.record && (
          <div className="shell-hd-pager">
            <Button
              aria-label={t.header.prev}
              icon={<CaretLeft aria-hidden="true" />}
              disabled={p.record.index <= 1}
              onClick={p.record.onPrev}
            />
            <span>
              {t.header.recordPos(format.number(p.record.index), format.number(p.record.total))}
            </span>
            <Button
              aria-label={t.header.next}
              icon={<CaretRight aria-hidden="true" />}
              disabled={p.record.index >= p.record.total}
              onClick={p.record.onNext}
            />
          </div>
        )
      ) : (
        <div className="shell-hd-find">
          {p.savedViews && p.savedViews.length > 0 && (
            <Select
              className="shell-hd-saved"
              aria-label={t.header.savedViews}
              options={p.savedViews}
              value={p.savedView ?? p.savedViews[0]?.value ?? null}
              onChange={(v: string) => p.onSavedViewChange?.(v)}
              popupMatchSelectWidth={false}
            />
          )}
          <Input
            type="search"
            className="shell-hd-search"
            aria-label={t.header.search}
            placeholder={t.header.searchPlaceholder}
            prefix={<MagnifyingGlass aria-hidden="true" />}
            value={p.search ?? ''}
            onChange={(e) => p.onSearchChange?.(e.target.value)}
          />
          <Button className="shell-hd-filter" icon={<Funnel aria-hidden="true" />}>
            {t.header.filter}
            {filters.length > 0 && <span className="shell-hd-badge">{filters.length}</span>}
          </Button>
        </div>
      )}

      <div className="shell-hd-vsw">
        <Segmented<ViewType>
          aria-label={t.header.viewType}
          value={p.view}
          onChange={p.onViewChange}
          options={shellTokens.header.viewTypes.map((v) => {
            const I = viewIcons[v.value];
            return {
              value: v.value,
              title: v.label,
              label: (
                <span className="shell-vsw-i">
                  <I aria-hidden="true" />
                  <span className="shell-vh">{v.label}</span>
                </span>
              ),
            };
          })}
        />
      </div>

      {!isForm && filters.length > 0 && (
        <div className="shell-hd-chips" role="group" aria-label={t.header.activeFilters}>
          {filters.map((f) => (
            <Fragment key={f.key}>
              <Tag
                className="shell-hd-chip"
                closable
                closeIcon={<X aria-label={t.header.removeFilter(f.label)} />}
                onClose={() => p.onRemoveFilter?.(f.key)}
              >
                {f.label}
              </Tag>
            </Fragment>
          ))}
          <Button type="link" size="small" onClick={p.onClearFilters}>
            {t.header.clearFilters}
          </Button>
        </div>
      )}
    </div>
  );
}
