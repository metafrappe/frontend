#!/usr/bin/env node
/**
 * Wrap gate (AJA-1747). `overflow-wrap: anywhere` breaks a word between any two letters and lowers the
 * min-content width. A heading or a table cell must never use it: a word that fits its line would be
 * split. The value is only free on a long link (the rule's subject is an `a` element or a link role).
 *
 * - CSS, SCSS and Less files are read rule by rule. A heading or table cell rule always fails.
 * - Any other rule with `anywhere` fails unless `scripts/wrap-gate.allow.json` lists its file and
 *   selector with an owner and a reason. The `word-wrap` alias counts too.
 * - TypeScript and JavaScript inline styles (`overflowWrap: 'anywhere'`, CSS text in strings) always
 *   fail: the element they reach is not known.
 *
 * Every violation prints the file name and the line. Usage: node scripts/wrap-gate.mjs [root]
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const CSS_EXT = new Set(['.css', '.scss', '.less']);
const JS_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const SKIP_DIRS = new Set(['node_modules', 'dist', 'coverage', '.git', '.pane', '.serena']);
const MIN_REASON = 10;

const ANYWHERE_DECL = /(?<![-\w])(?:overflow-wrap|word-wrap)\s*:\s*anywhere(?![-\w])/g;
const ANYWHERE_JS = /(?<![-\w])(?:overflowWrap|wordWrap)['"]?\s*:\s*['"`]anywhere['"`]/g;

const HEADING_RE = /(?:^|[\s>+~(,])h[1-6](?![-\w])|\[role=["']?heading|ant-typography-title/;
const CELL_RE =
  /(?:^|[\s>+~(,])(?:td|th)(?![-\w])|\[role=["']?(?:cell|gridcell|columnheader|rowheader)|ant-table-cell|ant-descriptions-item-(?:label|content)/;
const LINK_SUBJECT_RE = /^(?:a(?![-\w])|\[role=["']?link)/;

/** Test and script files are not product styles. */
export function isWrapExempt(file) {
  const f = file.split(sep).join('/');
  return (
    f.startsWith('tests/') ||
    f.startsWith('scripts/') ||
    /\.(test|spec)\.[cm]?[jt]sx?$/.test(f) ||
    /\/e2e\//.test(f)
  );
}

function lineAt(text, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) if (text.charCodeAt(i) === 10) line += 1;
  return line;
}

/** Replaces comments with spaces and keeps the newlines, so line numbers stay correct. */
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
}

const normalise = (selector) => selector.replace(/\s+/g, ' ').trim();

/** The last compound selector of a complex selector: `.a > td.b` gives `td.b`. */
function subject(selector) {
  const parts = selector.trim().split(/\s*[\s>+~]\s*/);
  return parts[parts.length - 1] ?? '';
}

function classify(selector) {
  const parts = selector
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.some((p) => HEADING_RE.test(` ${p}`) && !LINK_SUBJECT_RE.test(subject(p))))
    return 'heading';
  if (parts.some((p) => CELL_RE.test(` ${p}`) && !LINK_SUBJECT_RE.test(subject(p))))
    return 'table cell';
  if (parts.every((p) => LINK_SUBJECT_RE.test(subject(p)))) return 'link';
  return 'other';
}

/**
 * Returns the violations in the text: { file, line, selector, reason, text }.
 * `allow` is the list from `readWrapAllowList()`.
 */
export function findWrapViolations(text, file, allow = []) {
  const f = file.split(sep).join('/');
  if (isWrapExempt(f)) return [];
  const ext = f.slice(f.lastIndexOf('.'));
  const clean = text.replace(/\r\n/g, '\n');
  const out = [];

  if (JS_EXT.has(ext)) {
    for (const re of [ANYWHERE_JS, ANYWHERE_DECL]) {
      for (const m of clean.matchAll(re)) {
        out.push({
          file: f,
          line: lineAt(clean, m.index),
          selector: '',
          reason:
            'overflow-wrap: anywhere in an inline style: the element is unknown, use a CSS rule on a link',
          text: m[0],
        });
      }
    }
    return out.sort((a, b) => a.line - b.line);
  }
  if (!CSS_EXT.has(ext)) return [];

  const css = stripComments(clean);
  for (const rule of css.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
    const [, rawSelector = '', body = ''] = rule;
    // At-rule statements (`@import ...;`) before the selector are not part of it.
    const selector = normalise(rawSelector.slice(rawSelector.lastIndexOf(';') + 1));
    const bodyStart = rule.index + rawSelector.length + 1;
    for (const m of body.matchAll(ANYWHERE_DECL)) {
      const kind = classify(selector);
      if (kind === 'link') continue;
      if (kind === 'other' && allow.some((a) => a.dosya === f && normalise(a.secici) === selector))
        continue;
      out.push({
        file: f,
        line: lineAt(css, bodyStart + m.index),
        selector,
        reason:
          kind === 'other'
            ? 'overflow-wrap: anywhere is only allowed on a long link (or an allow list entry)'
            : `overflow-wrap: anywhere is forbidden on a ${kind}: it splits a word that fits its line`,
        text: m[0],
      });
    }
  }
  return out.sort((a, b) => a.line - b.line);
}

/** Allow list: scripts/wrap-gate.allow.json. Each entry holds file, selector, owner and reason. */
export function readWrapAllowList(
  file = join(dirname(fileURLToPath(import.meta.url)), 'wrap-gate.allow.json'),
) {
  if (!existsSync(file)) return [];
  const data = JSON.parse(readFileSync(file, 'utf8'));
  for (const item of data.izinler ?? []) {
    if (!item.dosya || !item.secici || !item.sahip || (item.neden ?? '').length < MIN_REASON) {
      throw new Error(
        `Wrap gate allow entry needs dosya, secici, sahip and neden (${MIN_REASON}+ characters): ${JSON.stringify(item)}`,
      );
    }
  }
  return data.izinler ?? [];
}

function walk(dir, root, acc) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, root, acc);
    else {
      const ext = name.slice(name.lastIndexOf('.'));
      if (CSS_EXT.has(ext) || JS_EXT.has(ext)) acc.push(relative(root, full));
    }
  }
  return acc;
}

/** Scans `src` under the root and returns every violation. */
export function scanWrapProject(root = process.cwd(), allow = readWrapAllowList()) {
  return walk(join(root, 'src'), root, []).flatMap((f) =>
    findWrapViolations(readFileSync(join(root, f), 'utf8'), f, allow),
  );
}

const isMain =
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].split(sep).join('/').replace(/^.*\//, ''));
if (isMain) {
  const violations = scanWrapProject(process.argv[2] ?? process.cwd());
  if (violations.length) {
    console.error(`Kırma kapısı: ${violations.length} ihlal.`);
    for (const v of violations)
      console.error(`  ${v.file}:${v.line}  ${v.reason}\n      ${v.selector} ${v.text}`);
    process.exit(1);
  }
  console.log('Kırma kapısı: ihlal yok.');
}
