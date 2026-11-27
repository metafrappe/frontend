import { Alert, Button } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { ActionOutcome, IdempotentRunner } from '@/api';

import { failureKind } from './data';
import { useCopy } from './messages';

/**
 * Kalıcı etkisi olan bir eylemin düğmesi ve sonucu.
 * Sözleşme: `metafrappe/backend` deposunda `contracts/idempotency.md` (AJA-1749, AJA-1754).
 *
 * - İki basış tek istek gönderir. Süren istek varken düğme "Processing" der.
 * - Kayıp yanıtta aynı iş anahtarıyla yeniden denenir.
 * - Sürüm çakışmasında kullanıcı uyarıyı görür. Formdaki değerler silinmez.
 */
export function IdempotentAction<T>({
  name,
  label,
  runner,
  send,
  onDone,
}: {
  /** Depo adı. `idempotencyKeyName(team, action, form)` ile üretilir. */
  name: string;
  label: string;
  runner: IdempotentRunner;
  send: (key: string) => Promise<T>;
  onDone?: (value: T) => void;
}) {
  const copy = useCopy();
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<ActionOutcome<T> | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const press = useCallback(() => {
    if (pending) return;
    setPending(true);
    setOutcome(null);
    void runner.run(name, send).then((result) => {
      if (!mounted.current) return;
      setPending(false);
      setOutcome(result);
      if (result.status === 'done') onDone?.(result.value);
    });
  }, [name, onDone, pending, runner, send]);

  return (
    <div className="module-stack">
      <Button
        type="primary"
        onClick={press}
        aria-disabled={pending || undefined}
        aria-busy={pending || undefined}
      >
        {pending ? copy.processing : label}
      </Button>
      <div aria-live="polite">{outcome && <OutcomeNotice outcome={outcome} />}</div>
    </div>
  );
}

function OutcomeNotice<T>({ outcome }: { outcome: ActionOutcome<T> }) {
  const copy = useCopy();
  switch (outcome.status) {
    case 'done':
      return <Alert type="success" message={copy.actionDone} />;
    case 'conflict':
      return (
        <Alert
          type="warning"
          message={copy.versionConflict}
          description={copy.versionConflictHint}
        />
      );
    case 'reused':
      return <Alert type="warning" message={copy.keyReused} />;
    case 'stale':
      return <Alert type="info" message={copy.staleKey} />;
    case 'uncertain':
      return <Alert type="warning" message={copy.actionUncertain} />;
    case 'failed':
      return <Alert type="error" message={copy[failureKind(outcome.error, true)]} />;
  }
}
