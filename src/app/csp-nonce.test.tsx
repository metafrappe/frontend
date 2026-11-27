import { render, screen } from '@testing-library/react';
import { Button } from 'antd';
import { afterEach, describe, expect, it } from 'vitest';

import { ensureDesignStyles } from '@/design/css-variables';

import { AppProviders } from './AppProviders';
import { readCspNonce } from '@/design/csp-nonce';

/** The server writes the nonce value into the `<meta property="csp-nonce" nonce="...">` element (backend panel.html). */
function addNonceMeta(value: string): HTMLMetaElement {
  const meta = document.createElement('meta');
  meta.setAttribute('property', 'csp-nonce');
  meta.nonce = value;
  document.head.append(meta);
  return meta;
}

afterEach(() => {
  document.head.querySelectorAll('meta[property="csp-nonce"]').forEach((el) => el.remove());
});

describe('CSP nonce', () => {
  it('meta öğesindeki nonce değerini okur', () => {
    addNonceMeta('ornek-nonce-1');
    expect(readCspNonce(document)).toBe('ornek-nonce-1');
  });

  it('meta yoksa ya da değer boşsa undefined döner', () => {
    expect(readCspNonce(document)).toBeUndefined();
    addNonceMeta('');
    expect(readCspNonce(document)).toBeUndefined();
  });

  it('tasarım stil öğesi nonce taşır', () => {
    addNonceMeta('ornek-nonce-2');
    const el = ensureDesignStyles();
    expect(el.nonce).toBe('ornek-nonce-2');
  });

  it('antd çalışma anında eklediği stil öğelerine nonce verir', () => {
    addNonceMeta('ornek-nonce-3');
    render(
      <AppProviders engines={false}>
        <Button>Örnek düğme</Button>
      </AppProviders>,
    );
    expect(screen.getByRole('button', { name: 'Örnek düğme' })).toBeTruthy();
    const antdStyles = [
      ...document.head.querySelectorAll<HTMLStyleElement>(
        'style[data-css-hash], style[data-rc-order]',
      ),
    ];
    expect(antdStyles.length).toBeGreaterThan(0);
    for (const style of antdStyles) expect(style.nonce).toBe('ornek-nonce-3');
  });

  it('nonce yoksa arayüz yine çizilir', () => {
    render(
      <AppProviders engines={false}>
        <Button>Nonce yok</Button>
      </AppProviders>,
    );
    expect(screen.getByRole('button', { name: 'Nonce yok' })).toBeTruthy();
  });
});
