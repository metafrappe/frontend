#!/usr/bin/env node
/* global process, console */
// Arka uç sözleşmelerini bu depoya kopyalar.
//
// Kaynak klasör bir ayardır. Sıra şöyledir:
//   1. --source <klasör> argümanı
//   2. ATONOTA_BACKEND_DIR ortam değişkeni
// Kaynak, metafrappe/backend deposunun yerel kopyasıdır.
// Kaynak klasör `contracts/` ve `docs/contracts.md` taşımalıdır.
// Kaynak bir git deposuysa commit kimliği git ile okunur.
// Değilse kaynak klasördeki `SOURCE_COMMIT` dosyası okunur.
//
// Kullanım:
//   node contracts/sync.mjs --source ../backend
//   node contracts/sync.mjs --source ../backend --check
//
// --check bir şey yazmaz. Kopya kaynaktan farklıysa 1 ile çıkar.

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

export const REPOSITORY = 'metafrappe/backend';

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
    // Kaynak başka bir deponun alt klasörü olabilir. Örneğin `.pane/backend-ref`.
    // O zaman dış deponun commit kimliği yanlış olur. Git yalnız kaynak deponun köküyse kullanılır.
    const top = realpathSync(gitOutput(source, ['rev-parse', '--show-toplevel']));
    if (top !== realpathSync(source)) throw new Error('Kaynak git kökü değil.');
    const commit = gitOutput(source, ['rev-parse', 'HEAD']);
    const status = gitOutput(source, [
      'status',
      '--porcelain',
      '--',
      'contracts',
      'docs/contracts.md',
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

/** Kaynaktaki dosyaları okur. Dönen her öğe hedef yolunu ve içeriğini taşır. */
export function collectSource(source) {
  const contractsDir = join(source, 'contracts');
  const docFile = join(source, 'docs', 'contracts.md');
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
    repository: REPOSITORY,
    commit: commitInfo.commit,
    dirty: commitInfo.dirty,
    commitSource: commitInfo.origin,
    files: files.map((file) => ({ path: file.target, sha256: sha256(file.content) })),
  };
}

function manifestText(manifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

/** Hedefteki kopyanın kaynakla aynı olup olmadığını söyler. Farkları döner. */
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
  // Eski kayıt başka bir depoyu yazabilir. Örneğin `frappesetup`. O kayıt yeni kaynakla eşleşmez.
  if (stored.repository !== manifest.repository)
    problems.push(`farklı depo: ${stored.repository} ve ${manifest.repository}`);
  // SOURCE_COMMIT dosyası kısa kimlik taşıyabilir. Bu yüzden kimlikler önekle karşılaştırılır.
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
