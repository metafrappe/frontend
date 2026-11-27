#!/usr/bin/env node
/* global process, console, fetch */
/**
 * Rule copy gate.
 *
 * `docs/standards/headless-frontend-standartlari.md` in this repository is a copy.
 * The source is the file on the `main` branch of the frappesetup repository.
 * The gate compares the two files byte for byte. If the files differ it exits with 1.
 *
 * If the source cannot be fetched, the gate also exits with 1. A network error does not count as "identical".
 *
 * To update the copy, download the source and overwrite the file:
 *   curl -fsSL <SOURCE_URL> -o docs/standards/headless-frontend-standartlari.md
 *
 * Usage: node scripts/standards-gate.mjs [--copy <file>] [--source-url <url>]
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const SOURCE_URL =
  'https://raw.githubusercontent.com/karacaismail/frappesetup/main/docs/standartlar/headless-frontend-standartlari.md';
export const COPY_PATH = resolve(root, 'docs/standards/headless-frontend-standartlari.md');

const TIMEOUT_MS = 30_000;

/**
 * Compares the copy with the source.
 * @param {{ copyPath?: string, sourceUrl?: string, fetchImpl?: typeof fetch }} [options]
 * @returns {Promise<{ ok: boolean, problems: string[] }>}
 */
export async function compareStandard({
  copyPath = COPY_PATH,
  sourceUrl = SOURCE_URL,
  fetchImpl = fetch,
} = {}) {
  let copy;
  try {
    copy = readFileSync(copyPath);
  } catch (error) {
    return { ok: false, problems: [`Kopya okunamadı: ${copyPath} (${String(error)})`] };
  }

  let source;
  try {
    const response = await fetchImpl(sourceUrl, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) {
      return {
        ok: false,
        problems: [`Kaynak alınamadı: ${sourceUrl} yanıtı HTTP ${response.status}.`],
      };
    }
    source = Buffer.from(await response.arrayBuffer());
  } catch (error) {
    return { ok: false, problems: [`Kaynak alınamadı: ${sourceUrl} (${String(error)})`] };
  }

  if (!copy.equals(source)) {
    return {
      ok: false,
      problems: [
        `Kopya kaynaktan farklı: ${copyPath} (${copy.length} bayt), kaynak ${source.length} bayt.`,
        `Kopyayı güncelleyin: curl -fsSL ${sourceUrl} -o ${copyPath}`,
      ],
    };
  }
  return { ok: true, problems: [] };
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--copy') args.copyPath = resolve(argv[++i] ?? '');
    else if (arg === '--source-url') args.sourceUrl = argv[++i];
    else throw new Error(`Bilinmeyen argüman: ${arg}`);
  }
  return args;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await compareStandard(parseArgs(process.argv.slice(2)));
  if (result.ok) {
    console.log('Kural kopyası kaynakla aynı.');
  } else {
    for (const problem of result.problems) console.error(problem);
    process.exitCode = 1;
  }
}
