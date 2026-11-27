// @vitest-environment node
// Türkçe yorum sayacının testi (AJA-1456).
//
// Sayaç kod yorumlarını ayrıştırıcıyla bulur. Tırnak içindeki metin yorum sayılmaz.
// Yorumda Türkçe harf ya da sık bir Türkçe kelime varsa yorum Türkçedir.
// Test küçük örnek dosyaları geçici bir klasöre yazar ve sayacı orada çalıştırır.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  extractComments,
  isTurkishComment,
  scanTurkishComments,
} from '../../scripts/tr-comments.mjs';

const SCRIPT = join(import.meta.dirname, '..', '..', 'scripts', 'tr-comments.mjs');

function turkishLines(text: string, file: string): number[] {
  return extractComments(text, file)
    .filter((comment) => isTurkishComment(comment.text))
    .map((comment) => comment.line);
}

describe('Türkçe yorumu tanıma', () => {
  it('Türkçe harfli yorumu Türkçe sayar', () => {
    expect(isTurkishComment('Kullanıcı adı boş kalamaz')).toBe(true);
    expect(isTurkishComment('İlk satır')).toBe(true);
  });

  it('Türkçe harfi olmayan Türkçe yorumu kelime listesiyle tanır', () => {
    expect(isTurkishComment('Test icin sabit deger')).toBe(true);
    expect(isTurkishComment('Bu alan zorunlu degil')).toBe(true);
  });

  it('İngilizce yorumu Türkçe saymaz', () => {
    expect(isTurkishComment('Keep the value stable for tests')).toBe(false);
    // "I've", "var" ve "her" yanlış alarm vermez.
    expect(isTurkishComment("I've moved her var into the de facto file")).toBe(false);
    expect(isTurkishComment('eslint-disable-next-line no-console')).toBe(false);
    // Kod adının içindeki Türkçe kelime sayılmaz.
    expect(isTurkishComment('The `kimlik_yalniz_keycloak` setting is 1.')).toBe(false);
    expect(isTurkishComment('Calls kimlik_yalniz_keycloak and api.kullanici.get')).toBe(false);
  });
});

describe('yorumları ayrıştırıcıyla bulma', () => {
  it('TypeScript dosyasında Türkçe yorumu sayar', () => {
    const ts = [
      '// Kullanıcı kaydı',
      'const a = 1; // sabit değer',
      '/* Çok satırlı',
      '   açıklama */',
      'export const b = a;',
    ].join('\n');
    expect(turkishLines(ts, 'src/a.ts')).toEqual([1, 2, 3]);
  });

  it('tırnak içindeki Türkçe metni saymaz', () => {
    const ts = [
      'const a = "Kaydet";',
      "const b = 'Şifre // değil yorum';",
      'const c = `Gönder /* değil */ ${a}`;',
      'const d = /çğü\\/\\/ş/u;',
    ].join('\n');
    expect(extractComments(ts, 'src/a.ts')).toEqual([]);
  });

  it('JSX metnini yorum saymaz ama JSX içindeki yorumu sayar', () => {
    const tsx = [
      'export const A = () => (',
      '  <p>',
      '    // Görünen metin',
      '    {/* Gizli açıklama */}',
      '  </p>',
      ');',
    ].join('\n');
    expect(turkishLines(tsx, 'src/A.tsx')).toEqual([4]);
  });

  it('İngilizce yorumu saymaz', () => {
    const ts = ['// Keep in sync with the backend', 'const a = 1; /* stable id */'].join('\n');
    expect(extractComments(ts, 'src/a.ts')).toHaveLength(2);
    expect(turkishLines(ts, 'src/a.ts')).toEqual([]);
  });

  it('CSS dosyasında tırnak içini atlar', () => {
    const css = [
      '/* Başlık rengi */',
      '.a { content: "/* değil */"; }',
      ".b::after { content: 'Şu'; } /* son not */",
    ].join('\n');
    expect(extractComments(css, 'src/a.css').map((c) => c.line)).toEqual([1, 3]);
    expect(turkishLines(css, 'src/a.css')).toEqual([1]);
  });

  it('YAML dosyasında tırnak ve blok metni ayırır, run betiğindeki yorumu sayar', () => {
    const yml = [
      '# İş akışı',
      'name: "CI # değil yorum"',
      "title: 'Şifre' # kısa açıklama",
      'description: |',
      '  # Bu satır metindir',
      '  Gövde',
      'steps:',
      '  - run: |',
      '      # Önbelleği temizle',
      '      echo "# değil" # print it',
      'url: http://a.b/#çapa',
    ].join('\n');
    const comments = extractComments(yml, '.github/workflows/ci.yml');
    expect(comments.map((c) => c.line)).toEqual([1, 3, 9, 10]);
    expect(turkishLines(yml, '.github/workflows/ci.yml')).toEqual([1, 3, 9]);
  });

  it('kabuk betiğinde shebang, tırnak, $# ve heredoc içini atlar', () => {
    const sh = [
      '#!/usr/bin/env bash',
      '# Tarayıcıları kur',
      'echo "# değil" \'# değil\' $# ${#ARR[@]} # sayı yaz',
      'cat <<EOF',
      '# Bu satır metindir',
      'EOF',
      'x=a#b',
    ].join('\n');
    expect(extractComments(sh, 'a.sh').map((c) => c.line)).toEqual([2, 3]);
    expect(turkishLines(sh, 'a.sh')).toEqual([2, 3]);
  });
});

describe('klasör taraması', () => {
  let root: string;

  function put(file: string, text: string) {
    const path = join(root, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
  }

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'tr-comments-'));
    put('src/shell/a.ts', '// Türkçe açıklama\nconst a = "Kaydet";\n');
    put('src/shell/b.tsx', '// English note\nexport const B = 1;\n');
    put('src/ai/c.css', '/* Renk ayarı */\n');
    put('scripts/d.mjs', '// Betik icin not\n');
    put('scripts/e.md', '<!-- Markdown dosyası taranmaz -->\n');
    put('node_modules/x/f.js', '// Bağımlılık taranmaz\n');
    put('dist/g.js', '// Derleme çıktısı taranmaz\n');
    put('contracts/openapi/h.openapi.yaml', '# Arka uç açıklaması\nopenapi: 3.1.0\n');
  });

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it('klasöre göre sayar, node_modules ve dist klasörünü atlar, OpenAPI dosyasını ayırır', () => {
    const result = scanTurkishComments(root);
    expect(result.byFolder).toEqual({ scripts: 1, 'src/ai': 1, 'src/shell': 1 });
    expect(result.total).toBe(3);
    expect(result.openapi.total).toBe(1);
    expect(result.openapi.hits.map((h) => h.file)).toEqual(['contracts/openapi/h.openapi.yaml']);
  });

  it('komut satırında toplamı yazar, --list ile dosya ve satırı yazar', () => {
    const run = (args: string[]) =>
      spawnSync(process.execPath, [SCRIPT, ...args, root], { encoding: 'utf8' });
    const summary = run([]);
    expect(summary.status).toBe(0);
    expect(summary.stdout).toMatch(/src\/shell\s+1/);
    expect(summary.stdout).toMatch(/Toplam\s+3/);
    expect(summary.stdout).toMatch(/OpenAPI\s+1/);
    expect(summary.stdout).not.toContain('src/shell/a.ts:1');

    const list = run(['--list']);
    expect(list.status).toBe(0);
    expect(list.stdout).toContain('src/shell/a.ts:1');
    expect(list.stdout).toContain('contracts/openapi/h.openapi.yaml:1');
    expect(list.stdout).not.toContain('Kaydet');
  });
});
