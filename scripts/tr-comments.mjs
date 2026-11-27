#!/usr/bin/env node
/**
 * Turkish comment counter (AJA-1456).
 *
 * Finds code comments in the repository and counts the Turkish ones. The script does not change comments.
 * It prints the count per folder and in total. The `--list` option also prints file and line.
 * The script always exits with code 0. The CI gate is set up by task AJA-1458.
 *
 * Comments are found with parsers. Comments are not guessed with regular expressions.
 * - `.ts`, `.tsx`, `.js` and `.mjs` files are parsed by the `typescript` package.
 *   Strings, template literals, regular expressions and JSX text are not comments.
 * - `.css`, `.yml`, `.yaml` and `.sh` files have small lexers.
 *   The lexer skips quoted text. YAML block scalars (`|`, `>`) are not comments.
 *   A `run: |` block in YAML is a shell script. Its comments are found with the shell rules.
 *   In shell, the shebang line, `$#`, `${#array}` and heredoc bodies are not comments.
 *
 * Turkish comment rule: a comment containing a Turkish letter is Turkish.
 * The letters are c-cedilla, g-breve, dotless i, dotted capital I, o-umlaut, s-cedilla and u-umlaut, with their capitals (`TR_LETTERS`).
 * For Turkish comments without such letters there is a list of common words. Example: `Test icin sabit deger`.
 *
 * OpenAPI files come from the backend. They are counted separately and are not in the total.
 * `src/api/generated/` files are generated from OpenAPI. They also go into the OpenAPI section.
 *
 * Usage: node scripts/tr-comments.mjs [--list] [root]
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const SCAN_EXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.css', '.yml', '.yaml', '.sh']);
const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'coverage',
  'playwright-report',
  'test-results',
  'blob-report',
  'all-blob-reports',
  'worktrees',
  '.git',
  '.pane',
  '.serena',
]);

/** Files that come from the backend or are generated from it. Counted separately. */
const OPENAPI_PREFIXES = ['contracts/openapi/', 'src/api/generated/'];

const TR_LETTERS = /[çğıİöşüÇĞÖŞÜ]/;

/**
 * Common Turkish words without Turkish letters. Words are written in lower case and ASCII form.
 * Words that gave false alarms were left out:
 * - `de` and `da`: German and Danish language codes.
 * - `var`: a JavaScript keyword.
 * - `her`, `once`, `son`, `gore`, `hem`, `alan`: English words or names.
 * - `ne`, `o`, `ki`: clash with short English abbreviations.
 */
export const TR_WORDS = new Set([
  've',
  'veya',
  'bir',
  'icin',
  'ile',
  'degil',
  'deger',
  'bu',
  'ama',
  'gibi',
  'olan',
  'olarak',
  'yok',
  'sonra',
  'kadar',
  'sadece',
  'yalniz',
  'eger',
  'ise',
  'daha',
  'cok',
  'tum',
  'butun',
  'simdi',
  'burada',
  'icinde',
  'uzere',
  'ayni',
  'yeni',
  'eski',
  'hata',
  'sabit',
  'dosya',
  'sayfa',
  'satir',
  'kayit',
  'zorunlu',
  'kullanici',
  'deneme',
]);

/** Is the comment text Turkish? */
export function isTurkishComment(text) {
  if (TR_LETTERS.test(text)) return true;
  // Inline code (`...`) is skipped. Space-separated tokens are checked.
  // A word inside a code name does not count. Example: `kimlik_yalniz_keycloak`, `api.kullanici.get`.
  // An apostrophe does not split a word. So `I've` is not counted as `ve`.
  for (const token of text.replace(/`[^`]*`/g, ' ').split(/\s+/)) {
    if (/[A-Za-z0-9][_./][A-Za-z0-9]/.test(token)) continue;
    const word = token.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '');
    if (TR_WORDS.has(word.toLowerCase())) return true;
  }
  return false;
}

/** Removes leading asterisks and blank lines from a block comment. */
function cleanBlock(body) {
  return body
    .split('\n')
    .map((line) => line.replace(/^\s*\*+ ?/, '').trimEnd())
    .filter((line) => line.trim() !== '')
    .join('\n')
    .trim();
}

// --- TypeScript and JavaScript ---------------------------------------------------------------

function scriptKind(file) {
  if (file.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (file.endsWith('.ts')) return ts.ScriptKind.TS;
  return ts.ScriptKind.JS;
}

function tsComments(text, file) {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, scriptKind(file));
  // Where JSX text starts. Comments are not looked for at these positions. JSX text is not a comment.
  const jsxText = new Set();
  const nodes = [];
  const visit = (node) => {
    if (node.kind >= ts.SyntaxKind.FirstJSDocNode && node.kind <= ts.SyntaxKind.LastJSDocNode)
      return;
    nodes.push(node);
    if (node.kind === ts.SyntaxKind.JsxText) jsxText.add(node.pos);
    for (const child of node.getChildren(sf)) visit(child);
  };
  visit(sf);

  const found = new Map();
  const add = (ranges) => {
    for (const range of ranges ?? []) {
      if (found.has(range.pos)) continue;
      const raw = text.slice(range.pos, range.end);
      const body =
        range.kind === ts.SyntaxKind.SingleLineCommentTrivia ? raw.slice(2) : raw.slice(2, -2);
      found.set(range.pos, {
        line: sf.getLineAndCharacterOfPosition(range.pos).line + 1,
        text: cleanBlock(body),
      });
    }
  };
  for (const node of nodes) {
    if (!jsxText.has(node.pos)) add(ts.getLeadingCommentRanges(text, node.pos));
    if (!jsxText.has(node.end)) add(ts.getTrailingCommentRanges(text, node.end));
  }
  return [...found.entries()].sort((a, b) => a[0] - b[0]).map(([, c]) => c);
}

// --- CSS --------------------------------------------------------------------------------------

function lineAt(text, index) {
  let line = 1;
  for (let i = 0; i < index; i++) if (text[i] === '\n') line++;
  return line;
}

function cssComments(text) {
  const out = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '"' || c === "'") {
      i++;
      while (i < text.length && text[i] !== c && text[i] !== '\n') i += text[i] === '\\' ? 2 : 1;
      i++;
    } else if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      const stop = end === -1 ? text.length : end;
      out.push({ line: lineAt(text, i), text: cleanBlock(text.slice(i + 2, stop)) });
      i = stop + 2;
    } else {
      i++;
    }
  }
  return out;
}

// --- Shell ------------------------------------------------------------------------------------

const SH_WORD_START = new Set([undefined, ' ', '\t', '\n', ';', '&', '|', '(', ')']);

function shComments(text, firstLine = 1) {
  const out = [];
  const lines = text.split('\n');
  let heredoc = null;
  let quote = null;
  for (let n = 0; n < lines.length; n++) {
    const line = lines[n];
    if (heredoc) {
      if ((heredoc.strip ? line.replace(/^\t+/, '') : line) === heredoc.word) heredoc = null;
      continue;
    }
    if (n === 0 && firstLine === 1 && line.startsWith('#!')) continue;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (quote) {
        if (quote === '"' && c === '\\') i++;
        else if (c === quote) quote = null;
        continue;
      }
      if (c === '\\') {
        i++;
      } else if (c === "'" || c === '"') {
        quote = c;
      } else if (c === '$' && line[i + 1] === '#') {
        i++;
      } else if (c === '$' && line[i + 1] === '{') {
        const end = line.indexOf('}', i);
        i = end === -1 ? line.length : end;
      } else if (c === '<' && line[i + 1] === '<' && line[i + 2] !== '<') {
        const m = /^<<(-?)\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\2/.exec(line.slice(i));
        if (m) {
          heredoc = { strip: m[1] === '-', word: m[3] };
          i += m[0].length - 1;
        }
      } else if (c === '#' && SH_WORD_START.has(line[i - 1])) {
        out.push({ line: firstLine + n, text: line.slice(i + 1).trim() });
        break;
      }
    }
  }
  return out;
}

// --- YAML -------------------------------------------------------------------------------------

const YAML_QUOTE_AFTER = new Set([undefined, ':', '-', '[', '{', ',', '?']);

/** Splits a line into its non-comment part and its comment. Quote state carries over between lines. */
function splitYamlLine(line, state) {
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (state.quote === "'") {
      if (c === "'" && line[i + 1] === "'") i++;
      else if (c === "'") state.quote = null;
      continue;
    }
    if (state.quote === '"') {
      if (c === '\\') i++;
      else if (c === '"') state.quote = null;
      continue;
    }
    if (c === "'" || c === '"') {
      const before = line.slice(0, i).trimEnd();
      if (YAML_QUOTE_AFTER.has(before[before.length - 1])) state.quote = c;
    } else if (c === '#' && (i === 0 || line[i - 1] === ' ' || line[i - 1] === '\t')) {
      return { value: line.slice(0, i), comment: line.slice(i + 1).trim() };
    }
  }
  return { value: line, comment: null };
}

const indentOf = (line) => line.length - line.trimStart().length;

function yamlComments(text) {
  const out = [];
  const lines = text.split('\n');
  const state = { quote: null };
  for (let n = 0; n < lines.length; n++) {
    const line = lines[n];
    const { value, comment } = splitYamlLine(line, state);
    if (comment !== null) out.push({ line: n + 1, text: comment });
    const block = /(^|[\s:-])([|>])[-+0-9]*\s*$/.exec(value);
    if (!block || state.quote) continue;
    // Block scalar: the following lines are indented deeper than this line. Blank lines belong to the block too.
    const parent = indentOf(line);
    let end = n + 1;
    while (end < lines.length && (lines[end].trim() === '' || indentOf(lines[end]) > parent)) end++;
    if (/(^|\s|-\s*)run:\s*\|/.test(value)) {
      out.push(...shComments(lines.slice(n + 1, end).join('\n'), n + 2));
    }
    n = end - 1;
  }
  return out;
}

// --- Common -----------------------------------------------------------------------------------

/** Returns all comments in the file: `{ line, text }`. Line numbers start at 1. */
export function extractComments(text, file) {
  const ext = extname(file);
  if (ext === '.css') return cssComments(text);
  if (ext === '.yml' || ext === '.yaml') return yamlComments(text);
  if (ext === '.sh') return shComments(text);
  return tsComments(text, file);
}

function listFiles(root, dir = root, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) listFiles(root, join(dir, entry.name), out);
    } else if (entry.isFile() && SCAN_EXT.has(extname(entry.name))) {
      out.push(relative(root, join(dir, entry.name)).split(sep).join('/'));
    }
  }
  return out.sort();
}

/** Folder name: the first two path segments. Example: `src/shell/a/b.ts` goes into the `src/shell` folder. */
export function folderOf(file) {
  const parts = file.split('/').slice(0, -1);
  return parts.slice(0, 2).join('/') || '.';
}

function group(hits) {
  const byFolder = {};
  for (const hit of hits) byFolder[folderOf(hit.file)] = (byFolder[folderOf(hit.file)] ?? 0) + 1;
  return Object.fromEntries(Object.entries(byFolder).sort(([a], [b]) => a.localeCompare(b)));
}

/** Scans the Turkish comments under the root. OpenAPI files are returned separately. */
export function scanTurkishComments(root) {
  const hits = [];
  const openapiHits = [];
  for (const file of listFiles(root)) {
    const text = readFileSync(join(root, file), 'utf8');
    const target = OPENAPI_PREFIXES.some((p) => file.startsWith(p)) ? openapiHits : hits;
    for (const comment of extractComments(text, file)) {
      if (isTurkishComment(comment.text)) target.push({ file, ...comment });
    }
  }
  return {
    byFolder: group(hits),
    total: hits.length,
    hits,
    openapi: { byFolder: group(openapiHits), total: openapiHits.length, hits: openapiHits },
  };
}

function table(byFolder, totalLabel, total) {
  const rows = [...Object.entries(byFolder), [totalLabel, total]];
  const width = Math.max(...rows.map(([k]) => String(k).length)) + 2;
  return rows.map(([k, v]) => `  ${String(k).padEnd(width)}${v}`).join('\n');
}

export function formatReport(result, { list = false } = {}) {
  const parts = [
    'Türkçe yorum sayısı, klasöre göre:',
    table(result.byFolder, 'Toplam', result.total),
    '',
    'OpenAPI dosyaları ayrı sayılır. Bu sayı toplama girmez:',
    table(result.openapi.byFolder, 'OpenAPI', result.openapi.total),
  ];
  if (list) {
    // In a multi-line comment the first Turkish line is shown. The line number is the start of the comment.
    const excerpt = (text) => {
      const rows = text.split('\n');
      return (rows.find((row) => isTurkishComment(row)) ?? rows[0] ?? '').trim();
    };
    const lines = (hits) => hits.map((h) => `${h.file}:${h.line}  ${excerpt(h.text)}`);
    parts.push('', '## Uygulama kodu', ...lines(result.hits));
    parts.push('', '## OpenAPI dosyaları', ...lines(result.openapi.hits));
  }
  return parts.join('\n');
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const args = process.argv.slice(2);
  const list = args.includes('--list');
  const root =
    args.find((a) => !a.startsWith('--')) ?? join(dirname(fileURLToPath(import.meta.url)), '..');
  console.log(formatReport(scanTurkishComments(root), { list }));
}
