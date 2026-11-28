/**
 * G-139 tur kancası. Ziyaret başında ilerlemeyi okur, turu açar ve her adımı kaydeder.
 *
 * - Tur odağı çalmaz. Kullanıcı yazarken tur açılırsa yazı sürer.
 * - Tur sayfayı değiştirmez: form temizlenmez, sayfa değişmez, girdi silinmez.
 * - Kayıt hatası turu bozmaz. Kayıtlar sırayla gider; eski kayıt yeni kaydın önüne geçmez.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  planTour,
  progressAfter,
  resolveTarget,
  visibleSteps,
  type TourDefinition,
  type TourEvent,
  type TourProgress,
  type TourStep,
} from './model';
import type { TourStore } from './store';

export interface TourController {
  definition: TourDefinition;
  open: boolean;
  steps: readonly TourStep[];
  index: number;
  step: TourStep | undefined;
  next(): void;
  back(): void;
  snooze(): void;
  skip(): void;
  restart(): void;
  /** Panelin kök öğesini bağlar. Kapanınca odak panelin içindeyse yeniden başlatma düğmesine döner. */
  bindPanel(element: HTMLElement | null): void;
  /** Yeniden başlatma düğmesini bağlar. */
  bindRestart(element: HTMLButtonElement | null): void;
  /** Düğüm panelin içinde mi? */
  inPanel(node: Node): boolean;
}

interface TourState {
  open: boolean;
  steps: TourStep[];
  index: number;
}

const CLOSED: TourState = { open: false, steps: [], index: 0 };

export interface UseTourOptions {
  definition: TourDefinition;
  store: TourStore;
  /** Kapalıysa tur kendiliğinden açılmaz. Yeniden başlatma düğmesi yine çalışır. */
  autoStart?: boolean;
}

export function useTour({ definition, store, autoStart = true }: UseTourOptions): TourController {
  const [state, setStateValue] = useState<TourState>(CLOSED);
  const stateRef = useRef<TourState>(CLOSED);
  const setState = useCallback((value: TourState) => {
    stateRef.current = value;
    setStateValue(value);
  }, []);
  const progress = useRef<TourProgress | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const panelRef = useRef<HTMLElement | null>(null);
  const restartRef = useRef<HTMLButtonElement | null>(null);
  const bindPanel = useCallback((element: HTMLElement | null) => {
    panelRef.current = element;
  }, []);
  const bindRestart = useCallback((element: HTMLButtonElement | null) => {
    restartRef.current = element;
  }, []);
  const inPanel = useCallback((node: Node) => panelRef.current?.contains(node) === true, []);

  const record = useCallback(
    (event: TourEvent, options: { restart?: boolean } = {}) => {
      const value = progressAfter(definition, progress.current, event);
      progress.current = value;
      queue.current = queue.current.then(() => store.save(value, options)).catch(() => undefined);
    },
    [definition, store],
  );

  const show = useCallback(
    (steps: TourStep[], index: number) => {
      const step = steps[index];
      if (!step) return;
      setState({ open: true, steps, index });
      record({ kind: 'show', step: step.id });
    },
    [record, setState],
  );

  const close = useCallback(() => {
    const panel = panelRef.current;
    const active = document.activeElement;
    if (panel && active instanceof Node && panel.contains(active)) {
      // Odak kaybolmasın: yeniden başlatma düğmesine döner.
      restartRef.current?.focus();
    }
    setState(CLOSED);
  }, [setState]);

  useEffect(() => {
    let alive = true;
    progress.current = null;
    store
      .load(definition.id)
      .then((stored) => {
        if (!alive) return;
        progress.current = stored;
        const plan = planTour(definition, stored);
        if (!autoStart || !plan.open) {
          setState(CLOSED);
          return;
        }
        const steps = visibleSteps(plan.steps);
        const wanted = plan.steps[plan.index]?.id;
        const index = Math.max(
          0,
          steps.findIndex((step) => step.id === wanted),
        );
        if (steps.length > 0) show(steps, index);
        else setState(CLOSED);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [definition, store, autoStart, show, setState]);

  /** Sıradaki gösterilebilir adım. Hedefi sonradan kaybolan adım atlanır. */
  const move = useCallback(
    (direction: 1 | -1) => {
      const current = stateRef.current;
      if (!current.open) return;
      let index = current.index + direction;
      while (index >= 0 && index < current.steps.length) {
        const step = current.steps[index];
        if (step && (!step.target || resolveTarget(step.target))) break;
        index += direction;
      }
      if (index < 0) return;
      if (index >= current.steps.length) {
        record({ kind: 'complete' });
        close();
        return;
      }
      show(current.steps, index);
    },
    [record, close, show],
  );

  const next = useCallback(() => move(1), [move]);
  const back = useCallback(() => move(-1), [move]);
  const snooze = useCallback(() => {
    record({ kind: 'snooze' });
    close();
  }, [record, close]);
  const skip = useCallback(() => {
    record({ kind: 'skip' });
    close();
  }, [record, close]);
  const restart = useCallback(() => {
    record({ kind: 'restart' }, { restart: true });
    const steps = visibleSteps(planTour(definition, null, { restart: true }).steps);
    if (steps.length > 0) show(steps, 0);
  }, [definition, record, show]);

  return useMemo(
    () => ({
      definition,
      open: state.open,
      steps: state.steps,
      index: state.index,
      step: state.open ? state.steps[state.index] : undefined,
      next,
      back,
      snooze,
      skip,
      restart,
      bindPanel,
      bindRestart,
      inPanel,
    }),
    [definition, state, next, back, snooze, skip, restart, bindPanel, bindRestart, inPanel],
  );
}
