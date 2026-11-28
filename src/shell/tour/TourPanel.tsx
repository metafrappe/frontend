/**
 * G-139 tur paneli. Kipsiz iletişim kutusudur: sayfayı kilitlemez, odağı çalmaz.
 *
 * - Ok tuşları panelin içindeyken ileri ve geri gider. Alanda yazan kullanıcıyı etkilemez.
 * - Escape turu erteler. Panelin dışında Escape yalnız başka bir öğe işlemediyse ve
 *   odak yazı alanında değilse turu erteler. Açık bir açılır listeyi kapatan Escape turu ertelemez.
 * - Adım bir `role="status"` bölgesinde duyurulur. Bölge tur kapalıyken de sayfada durur.
 * - Hedefe kaydırma, azaltılmış hareket isteniyorsa anında olur. Panelin kendi hareketi yoktur.
 */
import { Button } from 'antd';
import { useEffect, useId, type KeyboardEvent } from 'react';

import { usePrefersReducedMotion } from '@/app/use-reduced-motion';

import { tourText } from './messages';
import { resolveTarget } from './model';
import type { TourController } from './useTour';
import './tour.css';

const ACTIVE = 'data-tour-active';

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.closest('input, textarea, select, [role="combobox"], [role="listbox"]') !== null
  );
}

/** Etkin adımın hedefini işaretler ve görünür yapar. */
function useTargetHighlight(tour: TourController, reduced: boolean) {
  const target = tour.step?.target;
  useEffect(() => {
    if (!target) return undefined;
    const element = resolveTarget(target);
    if (!element) return undefined;
    element.setAttribute(ACTIVE, 'true');
    if (typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
        behavior: reduced ? 'auto' : 'smooth',
      });
    }
    return () => element.removeAttribute(ACTIVE);
  }, [target, reduced]);
}

/** Panelin dışında basılan Escape. */
function useOutsideEscape(tour: TourController) {
  const { open, snooze, inPanel } = tour;
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (event.target instanceof Node && inPanel(event.target)) return;
      if (isTyping(event.target)) return;
      snooze();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, snooze, inPanel]);
}

export function TourPanel({ tour }: { tour: TourController }) {
  const reduced = usePrefersReducedMotion();
  const titleId = useId();
  const bodyId = useId();
  useTargetHighlight(tour, reduced);
  useOutsideEscape(tour);

  const { step, steps, index, open, definition, next, back, snooze, skip, bindPanel } = tour;
  const total = steps.length;
  const last = index === total - 1;
  const announcement = step ? tourText.announce(index + 1, total, step.title) : '';

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      snooze();
      return;
    }
    if (isTyping(event.target)) return;
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      next();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      back();
    }
  };

  return (
    <>
      <p role="status" className="tour-announce">
        {announcement}
      </p>
      {open && step ? (
        <section
          ref={bindPanel}
          className="tour-panel"
          role="dialog"
          aria-modal="false"
          aria-label={tourText.label(definition.label)}
          aria-describedby={bodyId}
          onKeyDown={onKeyDown}
        >
          <p className="tour-progress">{tourText.progress(index + 1, total)}</p>
          <h2 id={titleId} className="tour-title">
            {step.title}
          </h2>
          <p id={bodyId} className="tour-body">
            {step.body}
          </p>
          <div className="tour-actions">
            <Button onClick={back} disabled={index === 0}>
              {tourText.back}
            </Button>
            <Button type="primary" onClick={next}>
              {last ? tourText.finish : tourText.next}
            </Button>
          </div>
          <div className="tour-actions tour-actions-quiet">
            <Button type="text" onClick={snooze}>
              {tourText.snooze}
            </Button>
            <Button type="text" onClick={skip}>
              {tourText.skip}
            </Button>
          </div>
        </section>
      ) : null}
    </>
  );
}

/** Turu baştan açan düğme. Sayfa onu kendi başlığında ya da yardım alanında gösterir. */
export function TourRestartButton({ tour }: { tour: TourController }) {
  const { restart, bindRestart } = tour;
  return (
    <Button ref={bindRestart} onClick={restart}>
      {tourText.restart}
    </Button>
  );
}
