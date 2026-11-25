// Ad `.node.test.ts` ile biter. Böylece Node türleri yalnız bu testte geçerlidir.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(`${process.cwd()}/${path}`, 'utf8');

/**
 * İlk yük bütçesi (G-137 incelemesi).
 * Kabuk yardım panelini kendisiyle birlikte indirmez. Panel ilk açılışta iner.
 * Panel `Switch` bileşenini toplu dosyadan almaz. Toplu dosya `InputNumber` ve `Radio`
 * parçalarını da pakete sokar.
 */
describe('yardım paneli içe aktarmaları', () => {
  it('kabuk paneli yalnız dinamik içe aktarmayla alır', () => {
    const shell = read('src/shell/layout/AppShell.tsx');
    expect(shell).not.toMatch(/^import[^;]*from '\.\.\/help\/HelpPanel';/m);
    expect(shell).toMatch(/import\('\.\.\/help\/HelpPanel'\)/);
  });

  it('panel Switch bileşenini kendi dosyasından alır', () => {
    const panel = read('src/shell/help/HelpPanel.tsx');
    expect(panel).not.toMatch(/from '@\/components\/controls'/);
    expect(panel).toMatch(/from '@\/components\/controls\/Switch'/);
  });
});
