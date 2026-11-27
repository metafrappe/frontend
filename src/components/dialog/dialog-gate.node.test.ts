// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Product code opens dialogs only through the shared components in this folder.
 * The narrow-area layout, result labels and focus return live there once (AJA-1745).
 */
const root = join(process.cwd(), 'src');
const own = join(root, 'components/dialog');

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return ['e2e', 'node_modules'].includes(entry.name) ? [] : sources(path);
    }
    if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) return [];
    return [path];
  });
}

const antdImport = /import\s*\{([^}]*)\}\s*from\s*'antd'/g;
const direct = /\b(Modal|Drawer|Popconfirm)\b/;

describe('dialogs use the shared components', () => {
  it('no product file imports Modal, Drawer or Popconfirm from antd', () => {
    const offenders = sources(root)
      .filter((path) => !path.startsWith(own))
      .flatMap((path) => {
        const text = readFileSync(path, 'utf8');
        return [...text.matchAll(antdImport)]
          .filter((match) => direct.test(match[1] ?? ''))
          .map(() => relative(process.cwd(), path));
      });
    expect(offenders).toEqual([]);
  });
});
