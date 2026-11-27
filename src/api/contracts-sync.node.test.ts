import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { readCommit, run } from '../../contracts/sync.mjs';

function makeSource({ git = false, commitFile }: { git?: boolean; commitFile?: string } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'sozlesme-kaynak-'));
  // metafrappe/backend düzeni: sözleşmeler depo kökündedir.
  mkdirSync(join(root, 'contracts'), { recursive: true });
  mkdirSync(join(root, 'docs'), { recursive: true });
  writeFileSync(join(root, 'contracts', 'a.openapi.yaml'), 'openapi: 3.1.0\n');
  writeFileSync(join(root, 'contracts', 'notlar.txt'), 'kopyalanmaz\n');
  writeFileSync(join(root, 'docs', 'contracts.md'), '# Sözleşmeler\n');
  if (commitFile) writeFileSync(join(root, 'SOURCE_COMMIT'), `${commitFile}\n`);
  if (git) {
    const env = {
      ...process.env,
      GIT_AUTHOR_NAME: 't',
      GIT_AUTHOR_EMAIL: 't@example.invalid',
      GIT_COMMITTER_NAME: 't',
      GIT_COMMITTER_EMAIL: 't@example.invalid',
    };
    execFileSync('git', ['init', '-q'], { cwd: root });
    execFileSync('git', ['-c', 'core.hooksPath=/dev/null', 'add', '.'], { cwd: root });
    execFileSync('git', ['-c', 'core.hooksPath=/dev/null', 'commit', '-q', '-m', 'ilk'], {
      cwd: root,
      env,
    });
  }
  return root;
}

describe('sözleşme kopyalama betiği', () => {
  it('yalnız OpenAPI dosyalarını ve ortak ad belgesini kopyalar', () => {
    const source = makeSource({ commitFile: 'abc1234' });
    const target = mkdtempSync(join(tmpdir(), 'sozlesme-hedef-'));

    const result = run(['--source', source, '--target', target]);

    expect(result.ok).toBe(true);
    expect(readFileSync(join(target, 'openapi', 'a.openapi.yaml'), 'utf8')).toBe(
      'openapi: 3.1.0\n',
    );
    expect(readFileSync(join(target, 'docs', 'contracts.md'), 'utf8')).toBe('# Sözleşmeler\n');
    const manifest = JSON.parse(readFileSync(join(target, 'SOURCE.json'), 'utf8'));
    expect(manifest.repository).toBe('metafrappe/backend');
    expect(manifest.commit).toBe('abc1234');
    expect(manifest.files.map((f: { path: string }) => f.path)).toEqual([
      'openapi/a.openapi.yaml',
      'docs/contracts.md',
    ]);
  });

  it('kaynak git kökü ise commit kimliğini git ile okur', () => {
    const source = makeSource({ git: true, commitFile: 'yanlis00' });
    const info = readCommit(source);
    expect(info.origin).toBe('git');
    expect(info.commit).toMatch(/^[0-9a-f]{40}$/);
  });

  it('kaynak başka deponun alt klasörü ise SOURCE_COMMIT dosyasını okur', () => {
    const outer = makeSource({ git: true });
    const inner = join(outer, 'ic');
    mkdirSync(join(inner, 'contracts'), { recursive: true });
    writeFileSync(join(inner, 'SOURCE_COMMIT'), 'def5678\n');
    expect(readCommit(inner)).toMatchObject({ commit: 'def5678', origin: 'SOURCE_COMMIT' });
  });

  it('--check kopya eskiyse farkı bildirir', () => {
    const source = makeSource({ commitFile: 'abc1234' });
    const target = mkdtempSync(join(tmpdir(), 'sozlesme-hedef-'));
    run(['--source', source, '--target', target]);
    writeFileSync(join(source, 'contracts', 'a.openapi.yaml'), 'openapi: 3.1.1\n');

    const result = run(['--source', source, '--target', target, '--check']);

    expect(result.ok).toBe(false);
    expect(result.problems).toContain('farklı: openapi/a.openapi.yaml');
  });

  it('eski düzendeki backend/contracts klasörünü kabul etmez', () => {
    const root = mkdtempSync(join(tmpdir(), 'sozlesme-eski-'));
    mkdirSync(join(root, 'backend', 'contracts'), { recursive: true });
    mkdirSync(join(root, 'backend', 'docs'), { recursive: true });
    writeFileSync(join(root, 'backend', 'contracts', 'a.openapi.yaml'), 'openapi: 3.1.0\n');
    writeFileSync(join(root, 'backend', 'docs', 'contracts.md'), '# Sözleşmeler\n');
    writeFileSync(join(root, 'SOURCE_COMMIT'), 'abc1234\n');
    const target = mkdtempSync(join(tmpdir(), 'sozlesme-hedef-'));

    expect(() => run(['--source', root, '--target', target])).toThrow(/contracts/);
  });

  it('eski frappesetup kaydı yeni kaynakla eşleşmez', () => {
    const source = makeSource({ commitFile: 'abc1234' });
    const target = mkdtempSync(join(tmpdir(), 'sozlesme-hedef-'));
    run(['--source', source, '--target', target]);
    // Dosyalar ve commit aynı kalır. Yalnız depo adı eski kaynağı yazar.
    const path = join(target, 'SOURCE.json');
    const stored = JSON.parse(readFileSync(path, 'utf8'));
    writeFileSync(path, `${JSON.stringify({ ...stored, repository: 'frappesetup' }, null, 2)}\n`);

    const result = run(['--source', source, '--target', target, '--check']);

    expect(result.ok).toBe(false);
    expect(result.problems).toContain('farklı depo: frappesetup ve metafrappe/backend');
  });

  it('yeni kaynaktan yazılan kopya --check ile geçer', () => {
    const source = makeSource({ commitFile: 'abc1234' });
    const target = mkdtempSync(join(tmpdir(), 'sozlesme-hedef-'));
    run(['--source', source, '--target', target]);

    expect(run(['--source', source, '--target', target, '--check'])).toMatchObject({
      ok: true,
      problems: [],
    });
  });

  it('kaynak verilmezse açık bir hata verir', () => {
    const saved = process.env.ATONOTA_BACKEND_DIR;
    delete process.env.ATONOTA_BACKEND_DIR;
    try {
      expect(() => run([])).toThrow(/--source/);
    } finally {
      if (saved !== undefined) process.env.ATONOTA_BACKEND_DIR = saved;
    }
  });
});
