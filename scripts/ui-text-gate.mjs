#!/usr/bin/env node
/**
 * Gömülü metin kapısı (G-73, IC-1). Bileşene gömülü ekran metni bulursa başarısız olur.
 * Ekran metni çeviri kataloğundan gelir: `src/app/locale/messages/`.
 *
 * Kapı `src/` altındaki `.tsx` dosyalarını TypeScript ayrıştırıcısıyla okur. Şunları metin sayar:
 * - JSX metni: `<p>Kayıt yok</p>`.
 * - Metin taşıyan öznitelikteki sabit metin: `aria-label="Göstergeler"`.
 * - JSX ifadesindeki sabit metin: `<b>{'Kaynak'}</b>`.
 * Harf içermeyen metin sayılmaz. Örnek: `·`, `/`, `—`.
 *
 * Test, önizleme, örnek veri ve e2e dosyaları taranmaz.
 *
 * Var olan dosyalar `scripts/ui-text-gate.allow.json` izin listesindedir. Dosya kataloğa taşınınca
 * listeden çıkarılır. Metni kalmayan dosya listede kalırsa kapı yine başarısız olur; liste böylece
 * yalnız kısalır. Kapı `npm run build` ve `npm run build:e2e` komutlarından önce çalışır.
 *
 * Kullanım: node scripts/ui-text-gate.mjs [kök]
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'e2e',
  'preview',
  'harness',
  'mocks',
  '__tests__',
  'test-support',
  'generated',
]);

/** Ekranda okunan ya da ekran okuyucunun söylediği öznitelikler. */
const TEXT_ATTRIBUTES = new Set([
  'aria-label',
  'aria-description',
  'aria-roledescription',
  'aria-valuetext',
  'title',
  'placeholder',
  'alt',
  'label',
  'tooltip',
  'okText',
  'cancelText',
  'description',
  'message',
  'content',
  'emptyText',
  'extra',
  'help',
  'addonBefore',
  'addonAfter',
  'caption',
  'summary',
  'heading',
  'subtitle',
  'text',
  'hint',
]);

const LETTER = /\p{L}/u;
const ALLOW_FILE = join('scripts', 'ui-text-gate.allow.json');

function isLiteral(node) {
  return node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node));
}

/** Bir dosyanın gömülü metinleri. Dönüş: `{ file, line, text }` listesi. */
export function findEmbeddedText(source, file) {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const hits = [];
  const add = (node, text) =>
    hits.push({ file, line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, text });
  const visit = (node) => {
    if (ts.isJsxText(node)) {
      const text = node.text.trim();
      if (LETTER.test(text)) add(node, text.replace(/\s+/g, ' '));
    } else if (ts.isJsxAttribute(node)) {
      const init = node.initializer;
      const name = node.name.getText(sf);
      if (TEXT_ATTRIBUTES.has(name)) {
        const literal = init && ts.isJsxExpression(init) ? init.expression : init;
        if (isLiteral(literal) && LETTER.test(literal.text)) add(node, literal.text);
      }
      return;
    } else if (ts.isJsxExpression(node) && isLiteral(node.expression)) {
      if (LETTER.test(node.expression.text)) add(node, node.expression.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return hits;
}

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return SKIP_DIRS.has(name) ? [] : sourceFiles(path);
    return name.endsWith('.tsx') && !/\.(test|spec)\.tsx$/.test(name) ? [path] : [];
  });
}

/** Kökteki `src/` altında bütün gömülü metinler. Yollar köke görelidir ve `/` ile yazılır. */
export function scanEmbeddedText(root) {
  const src = join(root, 'src');
  if (!existsSync(src)) return [];
  return sourceFiles(src).flatMap((path) =>
    findEmbeddedText(readFileSync(path, 'utf8'), relative(root, path).split(sep).join('/')),
  );
}

/** İzin listesi. Her kayıt `{ dosya, sahip, neden }` biçimindedir. */
export function readAllowList(root) {
  const path = join(root, ALLOW_FILE);
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, 'utf8')).izinler ?? [];
}

/** Kapının sonucu: izinsiz metinler ve gereksiz kalan izin kayıtları. */
export function checkEmbeddedText(root) {
  const allowed = new Set(readAllowList(root).map((entry) => entry.dosya));
  const hits = scanEmbeddedText(root);
  const withText = new Set(hits.map((hit) => hit.file));
  return {
    violations: hits.filter((hit) => !allowed.has(hit.file)),
    stale: [...allowed].filter((file) => !withText.has(file)),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = process.argv[2] ?? process.cwd();
  const { violations, stale } = checkEmbeddedText(root);
  for (const hit of violations)
    console.error(`${hit.file}:${hit.line}: gömülü metin "${hit.text}". Metni kataloğa taşıyın.`);
  for (const file of stale)
    console.error(`${file}: gömülü metin kalmadı. Dosyayı ${ALLOW_FILE} listesinden çıkarın.`);
  if (violations.length || stale.length) {
    console.error(
      `Gömülü metin kapısı başarısız: ${violations.length} metin, ${stale.length} gereksiz izin.`,
    );
    process.exit(1);
  }
  console.log('Gömülü metin kapısı geçti.');
}
