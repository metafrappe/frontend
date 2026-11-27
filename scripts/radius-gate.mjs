import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const ladder = new Set([0, 3, 5, 7, 9, 13, 17, 21, 25, 29]);
const radiusKey = (key) => /radius/i.test(key) || /^--r-/.test(key);

/** Inspect authored literals only. Geometry expressions are not evaluated. */
export function findRadiusViolations(source, file) {
  const violations = [];
  const report = (value, line, key) => violations.push({ file, line, reason: `${key}: ${value}` });
  const check = (value, line, key) => {
    // The guideline's geometry constants are not authored component radii.
    if (
      (key === '--r-bind' && value.trim() === '16px') ||
      (key === '--r-floor' && value.trim() === '2px')
    )
      return;
    for (const match of value.matchAll(/(?<![\w-])(-?\d*\.?\d+)(px|%|rem|em|vw|vh)?(?![\w.])/g)) {
      const [, number, unit] = match;
      if (unit === '%') continue;
      // A bare divisor in calc(height / 2) is geometry, not a corner literal.
      if (!unit && /(?:calc|min|max|clamp)\(/.test(value)) continue;
      if ((unit && unit !== 'px') || !ladder.has(Number(number))) report(match[0], line, key);
    }
  };
  const css = (text, baseLine = 1) => {
    const clean = text.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));
    for (const match of clean.matchAll(/(?:^|[;{}])\s*([\w-]+)\s*:\s*([^;{}]+)/g)) {
      if (!radiusKey(match[1])) continue;
      check(match[2], baseLine + clean.slice(0, match.index).split('\n').length - 1, match[1]);
    }
  };
  if (extname(file) === '.css') css(source);
  else if (extname(file) === '.json') {
    const walk = (value, path = '', radiusContext = false) => {
      if (typeof value === 'number' && radiusContext && !ladder.has(value)) report(value, 1, path);
      else if (typeof value === 'string') {
        if (value.includes('{')) css(value);
        else if (radiusContext) check(value, 1, path);
      } else if (value && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) {
          // Prose is not a declaration. Numeric radius fields and token maps are.
          if (['decision', 'rule', 'locked'].includes(key)) continue;
          walk(child, path ? `${path}.${key}` : key, radiusContext || radiusKey(key));
        }
      }
    };
    walk(JSON.parse(source));
  } else {
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    const inRadiusTokens = (node) => {
      for (let parent = node.parent; parent; parent = parent.parent) {
        if (
          (ts.isVariableDeclaration(parent) || ts.isPropertyAssignment(parent)) &&
          /radius/i.test(parent.name.getText(ast))
        )
          return true;
      }
      return false;
    };
    const visit = (node) => {
      if (ts.isPropertyAssignment(node)) {
        const key = node.name.getText(ast).replace(/^['"]|['"]$/g, '');
        if (
          /^border.*Radius/.test(key) ||
          (key.startsWith('--') && radiusKey(key)) ||
          inRadiusTokens(node)
        ) {
          const value = node.initializer;
          if (
            ts.isNumericLiteral(value) ||
            ts.isStringLiteral(value) ||
            ts.isPrefixUnaryExpression(value)
          ) {
            check(
              value.getText(ast).replace(/^['"]|['"]$/g, ''),
              ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1,
              key,
            );
          }
        }
      }
      // Generated design CSS can live in template literals rather than .css files.
      if (
        (ts.isStringLiteral(node) && node.text.includes('{')) ||
        ts.isNoSubstitutionTemplateLiteral(node) ||
        ts.isTemplateHead(node) ||
        ts.isTemplateMiddle(node) ||
        ts.isTemplateTail(node)
      ) {
        css(node.text, ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1);
      }
      ts.forEachChild(node, visit);
    };
    visit(ast);
  }
  return violations;
}

export function checkRadiusFiles(root) {
  const files = [];
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (
        [
          'node_modules',
          'dist',
          '.git',
          '.serena',
          '.pane',
          'test-results',
          'playwright-report',
        ].includes(entry.name)
      )
        continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) {
        const name = relative(root, path);
        if (
          name.endsWith('.css') ||
          (/^src\/.*\.[cm]?[jt]sx?$/.test(name) && !/\.(?:test|spec)\./.test(name)) ||
          name === 'design/source/control-size-config.json'
        )
          files.push(path);
      }
    }
  };
  walk(root);
  return files.flatMap((file) =>
    findRadiusViolations(readFileSync(file, 'utf8'), relative(root, file)),
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const violations = checkRadiusFiles(resolve(process.argv[2] ?? '.'));
  for (const { file, line, reason } of violations) console.error(`${file}:${line}: ${reason}`);
  if (violations.length) process.exitCode = 1;
  else console.log('Radius gate passed.');
}
