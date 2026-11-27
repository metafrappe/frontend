import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { findRadiusViolations } from '../../scripts/radius-gate.mjs';

describe('authored radius gate', () => {
  it.each(['10px', '12px', '5px 10px', '5px / 12px', 'var(--r-panel, 10px)'])(
    'rejects forbidden CSS radius %s',
    (value) => {
      expect(
        findRadiusViolations(`.card { border-radius: ${value}; }`, 'src/card.css'),
      ).not.toEqual([]);
    },
  );
  it('checks logical corners, custom radius tokens and theme literals', () => {
    for (const css of [
      'border-start-start-radius: 10px',
      '--card-radius: 12px',
      '--r-panel: 10px',
    ]) {
      expect(findRadiusViolations(`.card { ${css}; }`, 'src/card.css')).not.toEqual([]);
    }
    for (const code of [
      'const theme = { borderRadiusLG: 10 };',
      'const theme = { "borderRadiusSM": 12 };',
    ]) {
      expect(findRadiusViolations(code, 'src/design/antd-theme.ts')).not.toEqual([]);
    }
  });
  it.each(['0', '3px', '21px', 'var(--r-panel)', '50%', 'calc(var(--height) / 2)', 'inherit'])(
    'accepts step, token, capsule or inherited value %s',
    (value) => {
      expect(findRadiusViolations(`.card { border-radius: ${value}; }`, 'src/card.css')).toEqual(
        [],
      );
    },
  );
  it('checks the central radius token object and ignores unrelated geometry', () => {
    expect(
      findRadiusViolations(
        'export const radius = { control: 10, card: 12 };',
        'src/design/tokens.ts',
      ),
    ).toHaveLength(2);
    expect(findRadiusViolations('const eye = { radius: 2.2 };', 'src/mascot/Owl.tsx')).toEqual([]);
  });

  it('checks CSS stored in theme string literals', () => {
    expect(
      findRadiusViolations(
        'const rules = [".card { border-radius: 10px; }"];',
        'src/design/css-variables.ts',
      ),
    ).toHaveLength(1);
  });

  it('does not confuse spacing, comments or computed radii with authored corners', () => {
    expect(
      findRadiusViolations(
        '/* border-radius: 10px; */ .card { padding: 12px; border-radius: 21px; }',
        'src/card.css',
      ),
    ).toEqual([]);
    expect(
      findRadiusViolations('const style = { borderRadius: h / 2 };', 'src/design/theme.ts'),
    ).toEqual([]);
  });
  it('rejects JSON corner values and embedded CSS but permits unrelated dimensions', () => {
    for (const value of [
      { cards: { radius: 10 } },
      { radius: { default: 12 } },
      { derived: { css: ':root { --card-radius: 10px; }' } },
    ]) {
      expect(
        findRadiusViolations(JSON.stringify(value), 'design/source/control-size-config.json'),
      ).not.toEqual([]);
    }
    expect(
      findRadiusViolations(
        JSON.stringify({ cards: { radius: 21, padding: 24 }, fontSize: 12 }),
        'design/source/control-size-config.json',
      ),
    ).toEqual([]);
  });
  it('fails the executable gate for a new invalid CSS file', () => {
    const root = mkdtempSync(join(tmpdir(), 'radius-gate-'));
    try {
      mkdirSync(join(root, 'src'), { recursive: true });
      writeFileSync(join(root, 'src/new-card.css'), '.card { border-radius: 10px; }');
      const result = spawnSync(process.execPath, ['scripts/radius-gate.mjs', root], {
        encoding: 'utf8',
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('src/new-card.css');
      expect(result.stderr).toContain('10px');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  it('enforces the gate on current CSS, theme and source config in npm test', () => {
    expect(() =>
      execFileSync(process.execPath, ['scripts/radius-gate.mjs'], { encoding: 'utf8' }),
    ).not.toThrow();
  });
});
