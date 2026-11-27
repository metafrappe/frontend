import { Star } from '@phosphor-icons/react';
import { Button, Typography } from 'antd';
import { useEffect, useRef, useState } from 'react';

import { ApiError, userMessage, type ApiErrorKind } from '@/api';
import type { FavouriteClient } from '@/api/favourite-client';
import { useLanguage } from '@/app/locale/LanguageProvider';

import { FAVOURITE_MESSAGES } from './messages';

/**
 * The outcome of these errors is unknown: the server may have applied the change.
 * The screen does not guess. It reads the real state again.
 */
const UNCERTAIN: ReadonlySet<ApiErrorKind> = new Set([
  'network',
  'timeout',
  'unavailable',
  'invalid_response',
  'unknown',
]);

function asApiError(error: unknown): ApiError {
  return error instanceof ApiError ? error : new ApiError({ kind: 'unknown', status: 0 });
}

export interface FavouriteButtonProps {
  client: FavouriteClient;
  doctype: string;
  name: string;
  /** The state read with the record. */
  initial: boolean;
}

/**
 * Favourite on and off button (AJA-1774).
 *
 * 1. A press sends the target state. Example: "favourite = yes". It never sends "toggle".
 * 2. While a request runs, more presses do nothing. A double press sends one request.
 * 3. If the server rejects, the button shows the real server state and the reason.
 *    The reason is in the user's language and screen readers announce it.
 * 4. If the response is lost, the button reads the state again from the server.
 */
export function FavouriteButton({ client, doctype, name, initial }: FavouriteButtonProps) {
  const language = useLanguage();
  const [shown, setShown] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState<ApiError | null>(null);
  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => () => inFlight.current?.abort(), []);

  async function choose(target: boolean) {
    if (inFlight.current) return;
    const controller = new AbortController();
    inFlight.current = controller;
    const { signal } = controller;
    const record = { doctype, name };
    const before = shown;
    setShown(target);
    setBusy(true);
    setReason(null);
    try {
      const confirmed = await client.set(record, target, { signal });
      if (!signal.aborted) setShown(confirmed);
    } catch (error) {
      if (signal.aborted) return;
      const failure = asApiError(error);
      try {
        const real = await client.read(record, { signal });
        if (signal.aborted) return;
        setShown(real);
        if (!UNCERTAIN.has(failure.kind)) setReason(failure);
      } catch (readError) {
        if (signal.aborted) return;
        setShown(before);
        setReason(asApiError(readError));
      }
    } finally {
      if (inFlight.current === controller) inFlight.current = null;
      if (!signal.aborted) setBusy(false);
    }
  }

  return (
    <div>
      <Button
        size="large"
        aria-pressed={shown}
        aria-busy={busy}
        loading={busy}
        icon={<Star weight={shown ? 'fill' : 'regular'} aria-hidden="true" />}
        onClick={() => void choose(!shown)}
      >
        {FAVOURITE_MESSAGES[language].label}
      </Button>
      <div role="alert">
        {reason ? (
          <Typography.Text type="danger">{userMessage(reason, language)}</Typography.Text>
        ) : null}
      </div>
    </div>
  );
}
