// G-139 tur motorunun kuralları. Beklenen sonuçlar gereksinim metninden gelir:
// ilk ziyarette tur açılır; atla, ertele, yeniden başlat ve kaldığı yerden devam;
// ilerleme kullanıcı + tur + sürüm anahtarıyla saklanır; sürüm değişince yalnız yeni adımlar;
// hedef belge türü + alan adıyla ya da `data-tour-id` ile bulunur; hedef yoksa adım atlanır.
import { afterEach, describe, expect, it } from 'vitest';

import {
  type TourDefinition,
  type TourProgress,
  planTour,
  progressAfter,
  resolveTarget,
  visibleSteps,
} from './model';

const tour: TourDefinition = {
  id: 'leave-application',
  version: 1,
  label: 'İzin isteği',
  steps: [
    { id: 'intro', title: 'Hoş geldiniz', body: 'Kısa bir tur.' },
    {
      id: 'leave-type',
      title: 'İzin türü',
      body: 'Türü seçin.',
      target: { doctype: 'Leave Application', fieldname: 'leave_type' },
    },
    { id: 'save', title: 'Kaydet', body: 'Kaydedin.', target: { tourId: 'record-save' } },
  ],
};

const progress = (changes: Partial<TourProgress> = {}): TourProgress => ({
  tour_id: 'leave-application',
  version: 1,
  status: 'active',
  current_step: null,
  seen_steps: [],
  ...changes,
});

const ids = (steps: readonly { id: string }[]) => steps.map((step) => step.id);

describe('planTour', () => {
  it('ilk ziyarette turu bütün adımlarla ilk adımdan açar', () => {
    const plan = planTour(tour, null);
    expect(plan.open).toBe(true);
    expect(ids(plan.steps)).toEqual(['intro', 'leave-type', 'save']);
    expect(plan.index).toBe(0);
  });

  it('bitmiş ya da atlanmış tur aynı sürümde açılmaz', () => {
    expect(planTour(tour, progress({ status: 'completed', seen_steps: ['intro'] })).open).toBe(
      false,
    );
    expect(planTour(tour, progress({ status: 'skipped' })).open).toBe(false);
  });

  it('ertelenen tur sonraki ziyarette kaldığı adımdan sürer', () => {
    const plan = planTour(
      tour,
      progress({
        status: 'snoozed',
        current_step: 'leave-type',
        seen_steps: ['intro', 'leave-type'],
      }),
    );
    expect(plan.open).toBe(true);
    expect(plan.steps[plan.index]?.id).toBe('leave-type');
    expect(ids(plan.steps)).toEqual(['leave-type', 'save']);
  });

  it('tur sürümü yükselince yalnız görülmemiş yeni adımları gösterir', () => {
    const next: TourDefinition = {
      ...tour,
      version: 2,
      steps: [...tour.steps, { id: 'attachments', title: 'Ekler', body: 'Belge ekleyin.' }],
    };
    const seen = ['intro', 'leave-type', 'save'];
    for (const status of ['completed', 'skipped'] as const) {
      const plan = planTour(next, progress({ status, seen_steps: seen }));
      expect(plan.open).toBe(true);
      expect(ids(plan.steps)).toEqual(['attachments']);
      expect(plan.index).toBe(0);
    }
  });

  it('yeni sürümde yeni adım yoksa tur açılmaz', () => {
    const plan = planTour(
      { ...tour, version: 2 },
      progress({ status: 'completed', seen_steps: ['intro', 'leave-type', 'save'] }),
    );
    expect(plan.open).toBe(false);
  });

  it('yeniden başlatma bütün adımları ilk adımdan açar', () => {
    const plan = planTour(tour, progress({ status: 'completed', seen_steps: ['intro'] }), {
      restart: true,
    });
    expect(plan.open).toBe(true);
    expect(ids(plan.steps)).toEqual(['intro', 'leave-type', 'save']);
  });
});

describe('progressAfter', () => {
  it('gösterilen adım görülenlere eklenir ve kaldığı adım yazılır', () => {
    const value = progressAfter(tour, null, { kind: 'show', step: 'leave-type' });
    expect(value).toEqual(progress({ current_step: 'leave-type', seen_steps: ['leave-type'] }));
  });

  it('erteleme adımı korur, atlama turu bu sürüm için kapatır', () => {
    const base = progress({ current_step: 'leave-type', seen_steps: ['intro', 'leave-type'] });
    expect(progressAfter(tour, base, { kind: 'snooze' })).toMatchObject({
      status: 'snoozed',
      current_step: 'leave-type',
    });
    expect(progressAfter(tour, base, { kind: 'skip' })).toMatchObject({
      status: 'skipped',
      seen_steps: ['intro', 'leave-type', 'save'],
    });
  });

  it('bitirme turu tamamlar, yeniden başlatma görülenleri boşaltır', () => {
    const base = progress({ seen_steps: ['intro', 'leave-type', 'save'] });
    expect(progressAfter(tour, base, { kind: 'complete' })).toMatchObject({
      status: 'completed',
      current_step: null,
    });
    expect(progressAfter(tour, base, { kind: 'restart' })).toEqual(
      progress({ status: 'active', current_step: 'intro', seen_steps: [] }),
    );
  });

  it('ilerleme her zaman tanımın sürümüyle yazılır', () => {
    const value = progressAfter({ ...tour, version: 3 }, progress({ version: 1 }), {
      kind: 'show',
      step: 'intro',
    });
    expect(value.version).toBe(3);
  });
});

describe('resolveTarget ve visibleSteps', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('hedefi data-tour-id ile bulur', () => {
    document.body.innerHTML = '<button data-tour-id="record-save">Kaydet</button>';
    expect(resolveTarget({ tourId: 'record-save' })?.textContent).toBe('Kaydet');
  });

  it('hedefi belge türü ve alan adıyla bulur', () => {
    document.body.innerHTML = `
      <form data-doctype="Expense Claim"><div data-fieldname="leave_type">Yanlış</div></form>
      <form data-doctype="Leave Application"><div data-fieldname="leave_type">Doğru</div></form>`;
    expect(
      resolveTarget({ doctype: 'Leave Application', fieldname: 'leave_type' })?.textContent,
    ).toBe('Doğru');
  });

  it('tırnak içeren kimlik seçiciyi bozmaz', () => {
    document.body.innerHTML = '<div data-tour-id="a&quot;b">x</div>';
    expect(resolveTarget({ tourId: 'a"b' })).not.toBeNull();
  });

  it('hedefi olmayan adım atlanır, hedefsiz adım her zaman görünür', () => {
    document.body.innerHTML = '<button data-tour-id="record-save">Kaydet</button>';
    expect(ids(visibleSteps(tour.steps))).toEqual(['intro', 'save']);
  });
});
