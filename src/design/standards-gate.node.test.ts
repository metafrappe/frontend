// @vitest-environment node
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { compareStandard, SOURCE_URL } from '../../scripts/standards-gate.mjs';

const GATE = resolve(__dirname, '../../scripts/standards-gate.mjs');
const SOURCE_TEXT = '# Kurallar\n\nKaynak metin.\n';

function writeCopy(text: string) {
  const dir = mkdtempSync(join(tmpdir(), 'kural-kopya-'));
  const file = join(dir, 'kopya.md');
  writeFileSync(file, text);
  return file;
}

function fakeFetch(status: number, body: string) {
  return () => Promise.resolve(new Response(body, { status }));
}

let server: Server | undefined;

afterEach(async () => {
  await new Promise<void>((done) => (server ? server.close(() => done()) : done()));
  server = undefined;
});

function serve(status: number, body: string) {
  return new Promise<string>((done) => {
    server = createServer((_req, res) => {
      res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(body);
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server!.address() as AddressInfo;
      done(`http://127.0.0.1:${port}/kaynak.md`);
    });
  });
}

function runGate(args: string[]) {
  return new Promise<{ code: number; out: string }>((done) => {
    execFile(process.execPath, [GATE, ...args], (error, stdout, stderr) => {
      done({ code: error ? (error.code as number) : 0, out: stdout + stderr });
    });
  });
}

describe('kural kopyası kapısı', () => {
  it('kaynak metafrappe/backend main dalındaki dosyadır', () => {
    expect(SOURCE_URL).toBe(
      'https://raw.githubusercontent.com/metafrappe/backend/main/docs/standards/headless-frontend-standartlari.md',
    );
  });

  it('CI adımı kaynağı metafrappe/backend diye adlandırır', () => {
    const ci = readFileSync(resolve(__dirname, '../../.github/workflows/ci.yml'), 'utf8');
    expect(ci).toContain('- name: Kural kopyası metafrappe/backend ile aynı mı');
  });

  it('kopya kaynakla bayt bayt aynıysa geçer', async () => {
    const result = await compareStandard({
      copyPath: writeCopy(SOURCE_TEXT),
      fetchImpl: fakeFetch(200, SOURCE_TEXT),
    });
    expect(result).toEqual({ ok: true, problems: [] });
  });

  it('kopya kaynaktan farklıysa hata verir', async () => {
    const result = await compareStandard({
      copyPath: writeCopy(SOURCE_TEXT.replace('Kaynak', 'Eski')),
      fetchImpl: fakeFetch(200, SOURCE_TEXT),
    });
    expect(result.ok).toBe(false);
    expect(result.problems.join('\n')).toContain('farklı');
  });

  it('yalnız satır sonu farkını da yakalar', async () => {
    const result = await compareStandard({
      copyPath: writeCopy(SOURCE_TEXT.replace(/\n/g, '\r\n')),
      fetchImpl: fakeFetch(200, SOURCE_TEXT),
    });
    expect(result.ok).toBe(false);
  });

  it('ağ hatasını aynı saymaz', async () => {
    const result = await compareStandard({
      copyPath: writeCopy(SOURCE_TEXT),
      fetchImpl: () => Promise.reject(new TypeError('fetch failed')),
    });
    expect(result.ok).toBe(false);
    expect(result.problems.join('\n')).toContain('alınamadı');
  });

  it('başarısız HTTP yanıtını aynı saymaz', async () => {
    const result = await compareStandard({
      copyPath: writeCopy(''),
      fetchImpl: fakeFetch(404, ''),
    });
    expect(result.ok).toBe(false);
    expect(result.problems.join('\n')).toContain('404');
  });

  it('kopya dosyası yoksa hata verir', async () => {
    const result = await compareStandard({
      copyPath: join(tmpdir(), 'olmayan-kural-kopyasi.md'),
      fetchImpl: fakeFetch(200, SOURCE_TEXT),
    });
    expect(result.ok).toBe(false);
  });

  it('komut satırında aynı kopyada 0, farklı kopyada 1 ile çıkar', async () => {
    const url = await serve(200, SOURCE_TEXT);
    const same = await runGate(['--copy', writeCopy(SOURCE_TEXT), '--source-url', url]);
    expect(same.code, same.out).toBe(0);
    const differs = await runGate(['--copy', writeCopy('başka\n'), '--source-url', url]);
    expect(differs.code, differs.out).toBe(1);
  });

  it('komut satırında kaynak alınamazsa 1 ile çıkar', async () => {
    const url = await serve(500, '');
    const failed = await runGate(['--copy', writeCopy(''), '--source-url', url]);
    expect(failed.code, failed.out).toBe(1);
  });
});
