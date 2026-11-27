// G-139 tur ilerlemesi istemcisi. Sözleşme: metafrappe/backend `contracts/platform_core-tour.openapi.yaml`.
import { describe, expect, it, vi } from 'vitest';

import type { DocumentRequest, DocumentResponse } from './client';
import { ApiError } from './errors';
import { createTourClient } from './tour-client';

const stored = {
  tour_id: 'leave-application',
  version: 2,
  status: 'snoozed',
  current_step: 'dates',
  seen_steps: ['intro', 'leave-type'],
};

function fakeApi(body: unknown, ok = true) {
  const frappeDocument = vi.fn((request: DocumentRequest): Promise<DocumentResponse> =>
    Promise.resolve(
      ok
        ? { ok: true, status: 200, etag: undefined, body }
        : {
            ok: false,
            error: new ApiError({ kind: 'forbidden', status: 403 }),
            body,
          },
    ).then((value) => {
      void request;
      return value;
    }),
  );
  return { frappeDocument };
}

describe('createTourClient', () => {
  it('ilerlemeyi GET ile ve tur kimliğiyle okur', async () => {
    const api = fakeApi({ message: stored });
    const client = createTourClient(api);

    await expect(client.load('leave-application')).resolves.toEqual(stored);
    expect(api.frappeDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        path: '/api/method/platform_core.api.tour.get_tour_progress',
        query: { tour_id: 'leave-application' },
      }),
    );
  });

  it('ilk ziyarette null döner', async () => {
    await expect(createTourClient(fakeApi({ message: null })).load('x')).resolves.toBeNull();
  });

  it('ilerlemeyi POST ile yazar ve kullanıcı adı göndermez', async () => {
    const api = fakeApi({ message: stored });
    await createTourClient(api).save(stored);
    const request = api.frappeDocument.mock.calls[0]?.[0];
    expect(request?.method).toBe('POST');
    expect(request?.path).toBe('/api/method/platform_core.api.tour.save_tour_progress');
    expect(request?.body).toEqual({ ...stored, restart: false });
    expect(JSON.stringify(request?.body)).not.toContain('user');
  });

  it('yeniden başlatma bayrağını iletir', async () => {
    const api = fakeApi({ message: { ...stored, seen_steps: [] } });
    await createTourClient(api).save({ ...stored, seen_steps: [] }, { restart: true });
    expect(api.frappeDocument.mock.calls[0]?.[0].body).toMatchObject({ restart: true });
  });

  it('sözleşmeye uymayan yanıtı reddeder', async () => {
    for (const message of [
      { ...stored, status: 'closed' },
      { ...stored, version: 0 },
      { ...stored, seen_steps: 'intro' },
      { ...stored, tour_id: 'Bad Id' },
    ]) {
      await expect(createTourClient(fakeApi({ message })).load('x')).rejects.toBeInstanceOf(
        ApiError,
      );
    }
  });

  it('sunucu hatasını olduğu gibi iletir', async () => {
    await expect(createTourClient(fakeApi({}, false)).load('x')).rejects.toMatchObject({
      kind: 'forbidden',
    });
  });
});
