/**
 * G-139 tur motorunun kuralları. Bu dosya saf işlevler içerir; React kullanmaz.
 *
 * - Tur içeriği arayüzdedir (`TourDefinition`). Sunucu yalnız ilerlemeyi tutar.
 * - İlerleme kullanıcı + tur + sürüm anahtarıyla saklanır. Kullanıcıyı sunucu oturumdan bilir.
 * - Tur sürümü değişince yalnız görülmemiş adımlar gösterilir.
 * - Adım hedefi `data-tour-id` ya da belge türü + alan adıyla bulunur. Hedef yoksa adım atlanır.
 * Sözleşme: metafrappe/backend `contracts/platform_core-tour.openapi.yaml`.
 */

export type TourStatus = 'active' | 'snoozed' | 'skipped' | 'completed';

/** Adımın hedefi. Ya `tourId` ya da `doctype` ile `fieldname` verilir. Hedefsiz adım ortada açılır. */
export type TourTarget = { tourId: string } | { doctype: string; fieldname: string };

export interface TourStep {
  /** Değişmeyen adım kimliği. Küçük harf, rakam, nokta, tire ve alt çizgi. */
  id: string;
  title: string;
  body: string;
  target?: TourTarget;
}

export interface TourDefinition {
  /** Değişmeyen tur kimliği. Örnek: `leave-application`. */
  id: string;
  /** İçerik sürümü. Yeni adım eklenince artırılır. */
  version: number;
  /** Panelde görünen tur adı. */
  label: string;
  steps: readonly TourStep[];
}

/** Sunucudaki ilerleme. Alan adları sözleşmedeki adlardır. */
export interface TourProgress {
  tour_id: string;
  version: number;
  status: TourStatus;
  current_step: string | null;
  seen_steps: string[];
}

export interface TourPlan {
  open: boolean;
  steps: TourStep[];
  index: number;
}

export type TourEvent =
  | { kind: 'show'; step: string }
  | { kind: 'snooze' }
  | { kind: 'skip' }
  | { kind: 'complete' }
  | { kind: 'restart' };

export const TOUR_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}$/;
export const TOUR_STATUSES: readonly TourStatus[] = ['active', 'snoozed', 'skipped', 'completed'];
export const MAX_SEEN_STEPS = 200;
export const MAX_TOUR_VERSION = 100_000;

const closed: TourPlan = { open: false, steps: [], index: 0 };

/** Ziyaret başında turun açılıp açılmayacağını ve hangi adımların gösterileceğini söyler. */
export function planTour(
  definition: TourDefinition,
  progress: TourProgress | null,
  options: { restart?: boolean } = {},
): TourPlan {
  const all = [...definition.steps];
  if (!progress || options.restart) return { open: all.length > 0, steps: all, index: 0 };
  const seen = new Set(progress.seen_steps);
  if (progress.version < definition.version) {
    // Yeni sürüm: yalnız yeni adımlar. Önceki durum ne olursa olsun.
    const fresh = all.filter((step) => !seen.has(step.id));
    return fresh.length > 0 ? { open: true, steps: fresh, index: 0 } : closed;
  }
  if (progress.status === 'completed' || progress.status === 'skipped') return closed;
  // Devam: görülmemiş adımlar ve kalınan adım. Kalınan adımdan açılır.
  const pending = all.filter((step) => !seen.has(step.id) || step.id === progress.current_step);
  if (pending.length === 0) return closed;
  const index = Math.max(
    0,
    pending.findIndex((step) => step.id === progress.current_step),
  );
  return { open: true, steps: pending, index };
}

function unique(steps: readonly string[]): string[] {
  return [...new Set(steps)].slice(0, MAX_SEEN_STEPS);
}

/** Bir olaydan sonraki ilerlemeyi hesaplar. Sürüm her zaman tanımın sürümüdür. */
export function progressAfter(
  definition: TourDefinition,
  progress: TourProgress | null,
  event: TourEvent,
): TourProgress {
  const base: TourProgress = {
    tour_id: definition.id,
    version: definition.version,
    status: 'active',
    current_step: progress?.current_step ?? null,
    seen_steps: [...(progress?.seen_steps ?? [])],
  };
  switch (event.kind) {
    case 'show':
      return {
        ...base,
        current_step: event.step,
        seen_steps: unique([...base.seen_steps, event.step]),
      };
    case 'snooze':
      return { ...base, status: 'snoozed' };
    case 'skip':
      // Atlanan sürümün adımları görülmüş sayılır. Sonraki sürümde yalnız yeni adımlar çıkar.
      return {
        ...base,
        status: 'skipped',
        seen_steps: unique([...base.seen_steps, ...definition.steps.map((step) => step.id)]),
      };
    case 'complete':
      return { ...base, status: 'completed', current_step: null };
    case 'restart':
      return { ...base, current_step: definition.steps[0]?.id ?? null, seen_steps: [] };
  }
}

/** CSS öznitelik değerini tırnak içinde güvenle yazar. */
function attr(value: string): string {
  return `"${value.replace(/["\\]/g, '\\$&')}"`;
}

/** Adımın hedef öğesini bulur. Bulamazsa `null` döner. */
export function resolveTarget(target: TourTarget, root: ParentNode = document): HTMLElement | null {
  if ('tourId' in target) {
    return root.querySelector<HTMLElement>(`[data-tour-id=${attr(target.tourId)}]`);
  }
  return root.querySelector<HTMLElement>(
    `[data-doctype=${attr(target.doctype)}] [data-fieldname=${attr(target.fieldname)}]`,
  );
}

/** Sayfada gösterilebilen adımlar: hedefsiz adımlar ve hedefi bulunan adımlar. */
export function visibleSteps(steps: readonly TourStep[], root: ParentNode = document): TourStep[] {
  return steps.filter((step) => !step.target || resolveTarget(step.target, root) !== null);
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isIdentifier = (value: unknown): value is string =>
  typeof value === 'string' && TOUR_ID_PATTERN.test(value);

/** Sunucudan ya da tarayıcı deposundan gelen değeri sözleşmeye göre denetler. */
export function isTourProgress(value: unknown): value is TourProgress {
  return (
    isRecord(value) &&
    isIdentifier(value.tour_id) &&
    typeof value.version === 'number' &&
    Number.isInteger(value.version) &&
    value.version >= 1 &&
    value.version <= MAX_TOUR_VERSION &&
    TOUR_STATUSES.includes(value.status as TourStatus) &&
    (value.current_step === null || isIdentifier(value.current_step)) &&
    Array.isArray(value.seen_steps) &&
    value.seen_steps.length <= MAX_SEEN_STEPS &&
    value.seen_steps.every(isIdentifier)
  );
}

/** Sunucunun birleştirme kuralı. Bellek ve tarayıcı depoları da aynı kuralı uygular. */
export function mergeProgress(
  stored: TourProgress | null,
  incoming: TourProgress,
  restart = false,
): TourProgress {
  if (!stored || restart) return { ...incoming, seen_steps: [...incoming.seen_steps] };
  const seen = unique([...stored.seen_steps, ...incoming.seen_steps]);
  if (incoming.version < stored.version) return { ...stored, seen_steps: seen };
  return { ...incoming, seen_steps: seen };
}
