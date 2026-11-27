import { Check, Clock, Warning, X } from '@phosphor-icons/react';
import { Button } from 'antd';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { HomeSummary, PendingApproval } from '@/api';
import { useFormat } from '@/app/locale';

import type { HeaderState } from '../header/PageHeader';
import { PageHeader } from '../header/PageHeader';
import { t } from '../messages';
import type { ShellHomeData } from '../view-data/home-data';
import { HomeDataError, homeDataForModules } from '../view-data/home-data';
import { useViewData } from '../view-data/useViewData';
import { formatMoment, pendingMeta, pendingWho, problemText, recentText } from './homeFormat';

const m = t.home;
const noop = () => undefined;

/**
 * Address of the "New leave request" button: the human resources module (`src/modules/registry.ts`, `hr`).
 * There is no leave request form yet. The button opens the leave page.
 */
const NEW_LEAVE_PATH = '/hr';

type Load =
  | { kind: 'unconnected' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; data: HomeSummary; at: Date };

type Decision =
  | { kind: 'working'; action: 'approve' | 'reject' }
  | { kind: 'done'; action: 'approve' | 'reject' }
  | { kind: 'failed'; message: string };

function messageOf(error: unknown): string {
  return error instanceof HomeDataError ? error.message : m.loadFailed;
}

/** The home page's data connection. The explicit field comes first, then the module environment's connection. */
function useHomeData(): { data: ShellHomeData | undefined; waiting: boolean } {
  const view = useViewData();
  const data = view?.home ?? homeDataForModules(view?.modules);
  // The app entry sets up the module environment lazily. The page waits until the environment arrives.
  return { data, waiting: !data && view !== null };
}

/**
 * Home page: the Pending page. Mock-up AJA-880, screen 2 "Home page".
 * Section order: pending approvals, problem records, recent changes, summary counts.
 * The user approves or rejects a request on this screen. The result appears in the same row and is announced.
 * Loading shows no fake progress, percentage or made-up time.
 */
export default function HomePage() {
  const navigate = useNavigate();
  const { data: home, waiting } = useHomeData();
  const [attempt, setAttempt] = useState(0);
  // The sync time is written in the site's time zone and the user's locale (IC-13).
  const format = useFormat();
  // The result is stored with the connection that started the request and the attempt number.
  // When either changes, the old result is not used; the page goes back to "loading".
  const [result, setResult] = useState<{
    home: ShellHomeData;
    attempt: number;
    load: Load;
  } | null>(null);

  useEffect(() => {
    if (!home) return undefined;
    const ctrl = new AbortController();
    home.load(ctrl.signal).then(
      (data) => {
        if (ctrl.signal.aborted) return;
        setResult({
          home,
          attempt,
          load: { kind: 'ready', data, at: new Date() },
        });
      },
      (error: unknown) => {
        if (ctrl.signal.aborted) return;
        setResult({ home, attempt, load: { kind: 'error', message: messageOf(error) } });
      },
    );
    return () => ctrl.abort();
  }, [home, attempt]);

  let load: Load;
  if (!home) load = waiting ? { kind: 'loading' } : { kind: 'unconnected' };
  else if (result && result.home === home && result.attempt === attempt) load = result.load;
  else load = { kind: 'loading' };

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  let state: HeaderState;
  switch (load.kind) {
    case 'ready':
      state = { kind: 'normal', syncedAt: format.time(load.at) };
      break;
    case 'error':
      state = { kind: 'error', message: load.message, onRetry: retry };
      break;
    case 'loading':
      state = { kind: 'loading' };
      break;
    default:
      state = { kind: 'none' };
  }

  return (
    <div className="shell-page shell-home">
      <PageHeader
        title={m.title}
        crumbs={[{ label: m.title }]}
        view="report"
        onViewChange={noop}
        state={state}
        tools={false}
        primaryAction={{ label: m.newLeave, onClick: () => navigate(NEW_LEAVE_PATH) }}
      />
      <div className="shell-body">
        {load.kind === 'unconnected' && <p className="shell-muted">{m.notConnected}</p>}
        {load.kind === 'loading' && <p className="shell-muted">{m.loading}</p>}
        {load.kind === 'error' && <p className="shell-muted">{m.loadFailed}</p>}
        {load.kind === 'ready' && home && <HomeSections data={load.data} home={home} />}
      </div>
    </div>
  );
}

function HomeSections({ data, home }: { data: HomeSummary; home: ShellHomeData }) {
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [announce, setAnnounce] = useState('');
  const pendingId = useId();
  const format = useFormat();
  const problemsId = useId();
  const recentId = useId();
  const countsId = useId();

  const items = data.pending_approvals;
  const resolved = items.filter((i) => decisions[i.name]?.kind === 'done').length;
  const left = items.length - resolved;
  const pendingCount = Math.max(0, data.counts.pending_approvals - resolved);

  const decide = useCallback(
    (item: PendingApproval, action: 'approve' | 'reject') => {
      setDecisions((d) => ({ ...d, [item.name]: { kind: 'working', action } }));
      setAnnounce(m.working);
      const who = pendingWho(item);
      const target = { name: item.name, version: item.version };
      (action === 'approve' ? home.approve(target) : home.reject(target)).then(
        () => {
          setDecisions((d) => ({ ...d, [item.name]: { kind: 'done', action } }));
          setAnnounce(action === 'approve' ? m.resultApproved(who) : m.resultRejected(who));
        },
        (error: unknown) => {
          const message = messageOf(error);
          setDecisions((d) => ({ ...d, [item.name]: { kind: 'failed', message } }));
          setAnnounce(message);
        },
      );
    },
    [home],
  );

  let pendingTitle: string;
  if (left > 0) pendingTitle = m.pendingTitle(format.number(left));
  else if (items.length > 0) pendingTitle = m.pendingCleared;
  else pendingTitle = m.pendingNone;

  return (
    <>
      <section className="shell-home-sec" aria-labelledby={pendingId}>
        <h2 id={pendingId} className="shell-home-h">
          {pendingTitle}
        </h2>
        {items.length > 0 && (
          <ul className="shell-home-pending" aria-labelledby={pendingId}>
            {items.map((item) => (
              <PendingRow
                key={item.name}
                item={item}
                decision={decisions[item.name]}
                onDecide={decide}
              />
            ))}
          </ul>
        )}
        {left === 0 && <p className="shell-muted">{m.pendingEmpty}</p>}
        <p className="shell-vh" role="status" aria-live="polite" aria-label={m.resultRegion}>
          {announce}
        </p>
      </section>

      <div className="shell-home-pair">
        <section className="shell-home-sec" aria-labelledby={problemsId}>
          <h2 id={problemsId} className="shell-home-h">
            <Warning className="shell-home-ic" data-tone="warn" aria-hidden="true" />
            {m.problemsTitle}
          </h2>
          {data.problems.length > 0 ? (
            <ul className="shell-home-list">
              {data.problems.map((problem) => {
                const { tag, text } = problemText(problem);
                const key =
                  problem.kind === 'overlap'
                    ? problem.leaves.map((l) => l.name).join('+')
                    : problem.employee;
                return (
                  <li key={`${problem.kind}-${key}`}>
                    <span className="shell-home-tag" data-tone="warn">
                      {tag}
                    </span>
                    <span>{text}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="shell-muted">{m.problemsEmpty}</p>
          )}
        </section>

        <section className="shell-home-sec" aria-labelledby={recentId}>
          <h2 id={recentId} className="shell-home-h">
            {m.recentTitle}
          </h2>
          {data.recent_changes.length > 0 ? (
            <ul className="shell-home-list">
              {data.recent_changes.map((change) => (
                <li key={`${change.name}-${change.at}`} className="shell-home-recent">
                  <Clock className="shell-home-ic" aria-hidden="true" />
                  <span className="shell-home-recent-text">
                    <span>{recentText(change)}</span>
                    <small className="shell-home-meta">{formatMoment(change.at, format)}</small>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="shell-muted">{m.recentEmpty}</p>
          )}
        </section>
      </div>

      <section className="shell-home-sec" aria-labelledby={countsId}>
        <h2 id={countsId} className="shell-home-h">
          {m.countsTitle}
        </h2>
        <ul className="shell-home-kpis" aria-labelledby={countsId}>
          {(
            [
              ['pending_approvals', pendingCount],
              ['on_leave_today', data.counts.on_leave_today],
              ['opened_this_month', data.counts.opened_this_month],
              ['problems', data.counts.problems],
            ] as const
          ).map(([key, value]) => (
            <li key={key}>
              <strong className="shell-num">{format.number(value)}</strong>
              <span className="shell-home-meta">{m.counts[key]}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function PendingRow({
  item,
  decision,
  onDecide,
}: {
  item: PendingApproval;
  decision: Decision | undefined;
  onDecide: (item: PendingApproval, action: 'approve' | 'reject') => void;
}) {
  const whoId = useId();
  const format = useFormat();
  const noteRef = useRef<HTMLParagraphElement>(null);
  const who = pendingWho(item);
  const done = decision?.kind === 'done';
  const working = decision?.kind === 'working';

  // When the buttons disappear, focus moves to the result. So focus does not fall to the top of the page.
  useEffect(() => {
    const lost = document.activeElement === null || document.activeElement === document.body;
    if (done && lost) noteRef.current?.focus();
  }, [done]);

  if (done) {
    const approved = decision.action === 'approve';
    return (
      <li className="shell-home-item">
        <p className="shell-home-done" ref={noteRef} tabIndex={-1}>
          <span className="shell-home-tag" data-tone={approved ? 'ok' : 'err'}>
            {approved ? m.approved : m.rejected}
          </span>
          <span>{who}</span>
        </p>
      </li>
    );
  }

  const act = (action: 'approve' | 'reject') => () => {
    if (!working) onDecide(item, action);
  };

  return (
    <li className="shell-home-item" aria-busy={working}>
      <div className="shell-home-text">
        <p className="shell-home-who" id={whoId}>
          {who}
        </p>
        <p className="shell-home-meta">{pendingMeta(item, format)}</p>
      </div>
      <div className="shell-home-act">
        <Button
          type="primary"
          icon={<Check aria-hidden="true" />}
          aria-describedby={whoId}
          aria-disabled={working}
          onClick={act('approve')}
        >
          {m.approve}
        </Button>
        <Button
          danger
          icon={<X aria-hidden="true" />}
          aria-describedby={whoId}
          aria-disabled={working}
          onClick={act('reject')}
        >
          {m.reject}
        </Button>
      </div>
      {decision?.kind === 'failed' && (
        <p className="shell-home-err" role="alert">
          {decision.message}
        </p>
      )}
    </li>
  );
}
