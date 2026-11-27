// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  checkEmbeddedText,
  findEmbeddedText,
  readAllowList,
  scanEmbeddedText,
} from '../../../scripts/ui-text-gate.mjs';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const GATE = join(ROOT, 'scripts', 'ui-text-gate.mjs');

/**
 * İzin listesinin üst sınırı. Bu işten önce kapının kurallarına göre 34 dosyada gömülü metin vardı.
 * Bu iş beş genui dosyasını kataloğa taşıdı. Sınır yalnız aşağı iner.
 */
const ALLOW_LIST_MAX = 29;

/** Kapı alt süreçte TypeScript ayrıştırıcısını yükler. Yüklü makinede 5 saniyeyi aşabilir. */
const SPAWN_TIMEOUT = 30_000;

const temps: string[] = [];
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function project(files: Record<string, string>, allow: string[] = []): string {
  const dir = mkdtempSync(join(tmpdir(), 'ui-text-gate-'));
  temps.push(dir);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(dir, path, '..'), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  writeFileSync(
    join(dir, 'scripts', 'ui-text-gate.allow.json'),
    JSON.stringify({
      izinler: allow.map((dosya) => ({ dosya, sahip: 'test', neden: 'test kaydı' })),
    }),
  );
  return dir;
}

function runGate(dir: string): { code: number; output: string } {
  try {
    const output = execFileSync(process.execPath, [GATE, dir], { encoding: 'utf8', stdio: 'pipe' });
    return { code: 0, output };
  } catch (error) {
    const e = error as { status: number; stdout: string; stderr: string };
    return { code: e.status, output: e.stdout + e.stderr };
  }
}

describe('gömülü metin kapısı', () => {
  it('JSX metnini, metin özniteliğini ve ifade içindeki metni yakalar', () => {
    const hits = findEmbeddedText(
      [
        'export function A() {',
        '  return (',
        '    <section aria-label="Göstergeler">',
        '      <p>Kayıt bulunamadı.</p>',
        "      <b>{'Kaynak'}</b>",
        '    </section>',
        '  );',
        '}',
      ].join('\n'),
      'src/x/A.tsx',
    );
    expect(hits.map((h: { text: string }) => h.text)).toEqual([
      'Göstergeler',
      'Kayıt bulunamadı.',
      'Kaynak',
    ]);
  });

  it('JSX ifadesindeki koşullu metni ve değişkenli metnin sabit parçasını yakalar', () => {
    const hits = findEmbeddedText(
      [
        'export function A({ x, n }: { x: boolean; n: number }) {',
        '  return (',
        '    <div>',
        "      {x ? 'Aç' : 'Kapat'}",
        "      {x && 'Açık'}",
        "      {x || 'Boş'}",
        "      {(x as unknown as string) ?? 'Yok'}",
        '      {`Toplam ${n}`}',
        "      {x ? <b>Kalın</b> : 'Düz'}",
        '    </div>',
        '  );',
        '}',
      ].join('\n'),
      'src/x/A.tsx',
    );
    expect(hits.map((h: { text: string }) => h.text)).toEqual([
      'Aç',
      'Kapat',
      'Açık',
      'Boş',
      'Yok',
      'Toplam',
      'Kalın',
      'Düz',
    ]);
  });

  it('metin özniteliğindeki koşullu ve değişkenli metni yakalar', () => {
    const hits = findEmbeddedText(
      [
        'export function A({ x, n }: { x: boolean; n: number }) {',
        '  return (',
        "    <button aria-label={x ? 'Aç' : 'Kapat'} title={`Toplam ${n} kayıt`} placeholder={x && 'Ara'}>",
        '      {n}',
        '    </button>',
        '  );',
        '}',
      ].join('\n'),
      'src/x/A.tsx',
    );
    expect(hits.map((h: { text: string }) => h.text)).toEqual([
      'Aç',
      'Kapat',
      'Toplam kayıt',
      'Ara',
    ]);
  });

  it('öznitelik içindeki JSX metnini yakalar', () => {
    const hits = findEmbeddedText(
      [
        'export function A() {',
        '  return <Card extra={<span>Ek bilgi</span>} render={() => <p>Satır</p>} />;',
        '}',
      ].join('\n'),
      'src/x/A.tsx',
    );
    expect(hits.map((h: { text: string }) => h.text)).toEqual(['Ek bilgi', 'Satır']);
  });

  it('QA örneğindeki dört metni bulur', () => {
    const hits = findEmbeddedText(
      "export function A({ x }: { x: boolean }) { return <div aria-label=\"Deneme\"><p>Kayıt yok</p>{x ? 'Aç' : 'Kapat'}{`Toplam ${1}`}</div>; }",
      'src/qa/QaDeneme.tsx',
    );
    expect(hits.map((h: { text: string }) => h.text)).toEqual([
      'Deneme',
      'Kayıt yok',
      'Aç',
      'Kapat',
      'Toplam',
    ]);
  });

  it('koşulun karşılaştırmasını, çağrıyı ve sınıf adını metin saymaz', () => {
    const hits = findEmbeddedText(
      [
        "import { useMessage } from '@/app/locale';",
        'export function A({ kind }: { kind: string }) {',
        '  const m = useMessage();',
        '  return (',
        "    <p className={kind === 'wide' ? 'box wide' : 'box'} aria-label={kind === 'a' ? m('x.a') : m('x.b')}>",
        "      {kind === 'empty' ? m('x.empty') : m('x.full')}",
        "      {kind && m('x.kind', { kind: 'Ad' })}",
        '      {`${kind}`}',
        '    </p>',
        '  );',
        '}',
      ].join('\n'),
      'src/x/A.tsx',
    );
    expect(hits).toEqual([]);
  });

  it(
    'koşullu metin eklenen yeni bileşende kapı başarısız olur',
    () => {
      const dir = project({
        'src/new/Toggle.tsx':
          "export const T = ({ x }: { x: boolean }) => <button>{x ? 'Aç' : 'Kapat'}</button>;\n",
      });
      const result = runGate(dir);
      expect(result.code).not.toBe(0);
      expect(result.output).toContain('src/new/Toggle.tsx');
      expect(result.output).toContain('"Aç"');
    },
    SPAWN_TIMEOUT,
  );

  it('katalogdan gelen metni, sınıf adını ve işaret karakterini yakalamaz', () => {
    const hits = findEmbeddedText(
      [
        "import { useMessage } from '@/app/locale';",
        'export function A() {',
        '  const m = useMessage();',
        '  return (',
        '    <p className="box" aria-label={m(\'genui.kpis.label\')} data-genui="kpis">',
        "      {m('genui.source.title')} · {count}",
        '    </p>',
        '  );',
        '}',
      ].join('\n'),
      'src/x/A.tsx',
    );
    expect(hits).toEqual([]);
  });

  it(
    'yeni bir bileşene gömülü metin eklenince kapı başarısız olur',
    () => {
      const dir = project({ 'src/new/Widget.tsx': 'export const W = () => <p>Yeni metin</p>;\n' });
      const result = runGate(dir);
      expect(result.code).not.toBe(0);
      expect(result.output).toContain('src/new/Widget.tsx');
    },
    SPAWN_TIMEOUT,
  );

  it(
    'izin listesindeki eski dosya kapıyı düşürmez',
    () => {
      const dir = project({ 'src/old/Old.tsx': 'export const O = () => <p>Eski metin</p>;\n' }, [
        'src/old/Old.tsx',
      ]);
      expect(runGate(dir).code).toBe(0);
    },
    SPAWN_TIMEOUT,
  );

  it(
    'metni kalmayan dosya izin listesinde kalırsa kapı başarısız olur',
    () => {
      const dir = project({ 'src/old/Clean.tsx': 'export const C = () => <p>{1}</p>;\n' }, [
        'src/old/Clean.tsx',
      ]);
      const result = runGate(dir);
      expect(result.code).not.toBe(0);
      expect(result.output).toContain('src/old/Clean.tsx');
    },
    SPAWN_TIMEOUT,
  );

  it('test, önizleme ve örnek veri dosyalarını taramaz', () => {
    const dir = project({
      'src/a/A.test.tsx': 'export const T = () => <p>Test metni</p>;\n',
      'src/a/preview/P.tsx': 'export const P = () => <p>Önizleme</p>;\n',
      'src/mocks/M.tsx': 'export const M = () => <p>Örnek</p>;\n',
    });
    expect(scanEmbeddedText(dir)).toEqual([]);
  });
});

describe('depodaki durum', () => {
  it(
    'depo kapıdan geçer',
    () => {
      expect(checkEmbeddedText(ROOT)).toEqual({ violations: [], stale: [] });
    },
    SPAWN_TIMEOUT,
  );

  it(`izin listesi en çok ${ALLOW_LIST_MAX} dosyadır ve yalnız kısalır`, () => {
    expect(readAllowList(ROOT).length).toBeLessThanOrEqual(ALLOW_LIST_MAX);
  });

  it('kataloğa taşınan genui dosyaları izin listesinde değildir', () => {
    const allowed = readAllowList(ROOT).map((entry: { dosya: string }) => entry.dosya);
    for (const file of [
      'src/genui/blocks/JsonView.tsx',
      'src/genui/blocks/KpisView.tsx',
      'src/genui/blocks/SourceView.tsx',
      'src/genui/blocks/TableView.tsx',
      'src/genui/blocks/ChoicesView.tsx',
    ])
      expect(allowed).not.toContain(file);
  });

  it('derleme komutları kapıyı önce çalıştırır', () => {
    const scripts = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).scripts;
    expect(scripts.build).toMatch(/^node scripts\/ui-text-gate\.mjs && /);
    expect(scripts['build:e2e']).toMatch(/^node scripts\/ui-text-gate\.mjs && /);
  });
});
