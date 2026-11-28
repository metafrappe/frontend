import { describe, expect, it } from 'vitest';

import { usableModuleEnvironment } from './module-environment';

const session = {};
const env = { locale: 'tr' };

const loaded = { session, user: 'kisi', dataMode: 'live', locale: 'tr', env };

describe('usableModuleEnvironment: dil değişince modül sayfası düşmez (AJA-1772)', () => {
  it('aynı oturum, kullanıcı, kip ve dil için ortam kullanılır', () => {
    expect(
      usableModuleEnvironment(loaded, { session, user: 'kisi', dataMode: 'live', locale: 'tr' }),
    ).toBe(env);
  });

  it('yalnız dil değişince yeni ortam gelene kadar eski ortam kalır, sayfa yeniden kurulmaz', () => {
    expect(
      usableModuleEnvironment(loaded, { session, user: 'kisi', dataMode: 'live', locale: 'en' }),
    ).toBe(env);
  });

  it('oturum, kullanıcı ya da kip değişirse eski ortam kullanılmaz', () => {
    expect(
      usableModuleEnvironment(loaded, {
        session: {},
        user: 'kisi',
        dataMode: 'live',
        locale: 'tr',
      }),
    ).toBeUndefined();
    expect(
      usableModuleEnvironment(loaded, { session, user: 'baska', dataMode: 'live', locale: 'tr' }),
    ).toBeUndefined();
    expect(
      usableModuleEnvironment(loaded, { session, user: 'kisi', dataMode: 'example', locale: 'tr' }),
    ).toBeUndefined();
    expect(
      usableModuleEnvironment(undefined, { session, user: 'kisi', dataMode: 'live', locale: 'tr' }),
    ).toBeUndefined();
  });
});
