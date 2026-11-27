import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiErrorKind } from '../api';
import { createLatestRequest, scopedKey } from '../api/request-order';
import { useModule } from './context';
export type FailureKind =
  | 'forbidden'
  | 'expired'
  | 'invalid'
  | 'failure'
  | 'uncertain'
  | 'notFound'
  | 'conflict'
  | 'rateLimited'
  | 'requestRejected'
  | 'csrf';
const failures: Record<ApiErrorKind, FailureKind> = {
  session_expired: 'expired',
  forbidden: 'forbidden',
  not_found: 'notFound',
  conflict: 'conflict',
  rate_limited: 'rateLimited',
  invalid_request: 'requestRejected',
  csrf: 'csrf',
  network: 'failure',
  timeout: 'failure',
  unavailable: 'failure',
  unknown: 'failure',
  invalid_response: 'invalid',
};
export function failureKind(error: unknown, writing = false): FailureKind {
  const kind =
    typeof error === 'object' && error !== null && 'kind' in error ? error.kind : undefined;
  const failure =
    typeof kind === 'string' && Object.prototype.hasOwnProperty.call(failures, kind)
      ? failures[kind as ApiErrorKind]
      : error instanceof Error && error.message === 'invalid_response'
        ? 'invalid'
        : 'failure';
  return writing && (failure === 'failure' || failure === 'invalid') ? 'uncertain' : failure;
}
export type Resource<T> =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'error'; error: FailureKind }
  | { status: 'ready'; data: T };
/**
 * Reads data for a module screen. Request order rules come from `api/request-order` (AJA-1773):
 * the last request wins, an organisation or user change invalidates pending requests, and an
 * old response or error never reaches the screen.
 */
export function useRead<T>(load: ((signal: AbortSignal) => Promise<T>) | null, key: string) {
  const env = useModule();
  const [revision, setRevision] = useState(0);
  const requestKey = scopedKey(
    JSON.stringify([env?.tenant ?? '', env?.user ?? '']),
    `${key}:${revision}`,
  );
  const [result, setResult] = useState<{ key: string; state: Resource<T> }>();
  const [gate] = useState(createLatestRequest);
  useEffect(() => {
    if (!load) return;
    const ticket = gate.begin(requestKey);
    void (async () => {
      try {
        const data = await load(ticket.signal);
        if (ticket.isCurrent()) setResult({ key: requestKey, state: { status: 'ready', data } });
      } catch (error) {
        if (ticket.isCurrent())
          setResult({ key: requestKey, state: { status: 'error', error: failureKind(error) } });
      }
    })();
    return () => gate.cancel();
  }, [gate, load, requestKey]);
  const state: Resource<T> = !load
    ? { status: 'unavailable' }
    : result?.key === requestKey
      ? result.state
      : { status: 'loading' };
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  return { state, refresh };
}
export function useMutation() {
  const request = useRef<AbortController | null>(null);
  const [state, setState] = useState<
    { status: 'idle' | 'pending' | 'success' } | { status: 'error'; error: FailureKind }
  >({ status: 'idle' });
  useEffect(() => () => request.current?.abort(), []);
  async function run<T>(action: (signal: AbortSignal) => Promise<T>): Promise<T | undefined> {
    if (request.current) return undefined;
    const controller = new AbortController();
    request.current = controller;
    setState({ status: 'pending' });
    try {
      const result = await action(controller.signal);
      if (controller.signal.aborted) return undefined;
      setState({ status: 'success' });
      return result;
    } catch (error) {
      if (!controller.signal.aborted)
        setState({ status: 'error', error: failureKind(error, true) });
      return undefined;
    }
    // One write per review. A fresh read/remount is required after any outcome.
  }
  return { state, run };
}
