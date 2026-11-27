#!/usr/bin/env node
/* global process, console */
// Copies the backend contracts into this repository.
//
// The source folder is configurable. Precedence:
//   1. --source <folder> argument
//   2. ATONOTA_BACKEND_DIR environment variable
// The source folder must contain `backend/contracts/` and `backend/docs/contracts.md`.
// If the source is a git repository, the commit ID is read with git.
// Otherwise the `SOURCE_COMMIT` file in the source folder is read.
//
// Usage:
//   node contracts/sync.mjs --source ../frappesetup
//   node contracts/sync.mjs --source ../frappesetup --check
//
// --check writes nothing. Exits with 1 if the copy differs from the source.

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export const CONTRACT_PATTERN = /\.openapi\.(ya?ml|json)$/;

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function parseArgs(argv) {
  const args = { source: undefined, check: false, target: here };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--check') args.check = true;
    else if (arg === '--source') args.source = argv[++i];
    else if (arg === '--target') args.target = argv[++i];
    else throw new Error(`Bilinmeyen argüman: ${arg}`);
  }
  args.source ??= process.env.ATONOTA_BACKEND_DIR;
  return args;
}

function gitOutput(source, args) {
  return execFileSync('git', ['-C', source, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

export function readCommit(source) {
  try {
    // The source may be a subfolder of another repository, e.g. `.pane/backend-ref`.
    // Then the outer repository's commit ID would be wrong. Git is used only if the source is the repository root.
    const top = realpathSync(gitOutput(source, ['rev-parse', '--show-toplevel']));
    if (top !== realpathSync(source)) throw new Error('Kaynak git kökü değil.');
    const commit = gitOutput(source, ['rev-parse', 'HEAD']);
    const status = gitOutput(source, [
      'status',
      '--porcelain',
      '--',
      'backend/contracts',
      'backend/docs/contracts.md',
    ]);
    return { commit, dirty: status.length > 0, origin: 'git' };
  } catch {
    const file = join(source, 'SOURCE_COMMIT');
    if (existsSync(file)) {
      return { commit: readFileSync(file, 'utf8').trim(), dirty: false, origin: 'SOURCE_COMMIT' };
    }
    throw new Error(
      'Kaynak commit kimliği bulunamadı. Kaynak git deposu değil ve SOURCE_COMMIT dosyası yok.',
    );
  }
}

/** Reads the source files. Each returned item carries its target path and content. */
export function collectSource(source) {
  const contractsDir = join(source, 'backend', 'contracts');
  const docFile = join(source, 'backend', 'docs', 'contracts.md');
  if (!existsSync(contractsDir)) throw new Error(`Klasör yok: ${contractsDir}`);
  if (!existsSync(docFile)) throw new Error(`Dosya yok: ${docFile}`);

  const files = readdirSync(contractsDir)
    .filter((name) => CONTRACT_PATTERN.test(name))
    .sort()
    .map((name) => ({
      target: `openapi/${name}`,
      content: readFileSync(join(contractsDir, name)),
    }));
  if (files.length === 0) throw new Error(`Sözleşme dosyası yok: ${contractsDir}`);
  files.push({ target: 'docs/contracts.md', content: readFileSync(docFile) });
  return files;
}

export function buildManifest(files, commitInfo) {
  return {
    repository: 'frappesetup',
    commit: commitInfo.commit,
    dirty: commitInfo.dirty,
    commitSource: commitInfo.origin,
    files: files.map((file) => ({ path: file.target, sha256: sha256(file.content) })),
  };
}

function manifestText(manifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

/** Reports whether the target copy matches the source. Returns the differences. */
export function diffTarget(target, files, manifest) {
  const problems = [];
  for (const file of files) {
    const path = join(target, file.target);
    if (!existsSync(path)) problems.push(`eksik: ${file.target}`);
    else if (sha256(readFileSync(path)) !== sha256(file.content))
      problems.push(`farklı: ${file.target}`);
  }
  const openapiDir = join(target, 'openapi');
  if (existsSync(openapiDir)) {
    const expected = new Set(files.map((file) => file.target));
    for (const name of readdirSync(openapiDir)) {
      if (!expected.has(`openapi/${name}`)) problems.push(`fazla: openapi/${name}`);
    }
  }
  const manifestPath = join(target, 'SOURCE.json');
  if (!existsSync(manifestPath)) {
    problems.push('eksik: SOURCE.json');
    return problems;
  }
  const stored = JSON.parse(readFileSync(manifestPath, 'utf8'));
  // The SOURCE_COMMIT file may hold a short ID, so IDs are compared by prefix.
  const sameCommit =
    typeof stored.commit === 'string' &&
    stored.commit.length >= 7 &&
    (stored.commit.startsWith(manifest.commit) || manifest.commit.startsWith(stored.commit));
  if (!sameCommit) problems.push(`farklı commit: ${stored.commit} ve ${manifest.commit}`);
  if (JSON.stringify(stored.files) !== JSON.stringify(manifest.files))
    problems.push('farklı: SOURCE.json dosya listesi');
  return problems;
}

export function writeTarget(target, files, manifest) {
  rmSync(join(target, 'openapi'), { recursive: true, force: true });
  rmSync(join(target, 'docs'), { recursive: true, force: true });
  for (const file of files) {
    const path = join(target, file.target);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, file.content);
  }
  writeFileSync(join(target, 'SOURCE.json'), manifestText(manifest));
}

export function run(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (!args.source) {
    throw new Error(
      'Kaynak klasör verilmedi. --source argümanını ya da ATONOTA_BACKEND_DIR değişkenini kullanın.',
    );
  }
  const source = resolve(args.source);
  const target = resolve(args.target);
  const files = collectSource(source);
  const manifest = buildManifest(files, readCommit(source));

  if (args.check) {
    const problems = diffTarget(target, files, manifest);
    return { ok: problems.length === 0, problems, manifest };
  }
  writeTarget(target, files, manifest);
  return { ok: true, problems: [], manifest, written: relative(process.cwd(), target) || '.' };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = run();
    if (!result.ok) {
      console.error('Sözleşme kopyası kaynaktan farklı:');
      for (const problem of result.problems) console.error(`  ${problem}`);
      process.exit(1);
    }
    const dirty = result.manifest.dirty ? ' (kaynakta commit edilmemiş değişiklik var)' : '';
    console.log(`Sözleşmeler hazır. Kaynak commit: ${result.manifest.commit}${dirty}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(2);
  }
}
