import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// This test checks the real contract copy in the repository.
// The copy must come from a clean backend commit that has landed on the `backend` branch.
const contracts = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'contracts');

interface Source {
  commit: string;
  dirty: boolean;
  files: { path: string; sha256: string }[];
}

const source = JSON.parse(readFileSync(join(contracts, 'SOURCE.json'), 'utf8')) as Source;

function contract(name: string) {
  return readFileSync(join(contracts, 'openapi', `${name}.openapi.yaml`), 'utf8');
}

// These commit tips have not landed on the `backend` branch. They are tracked in tasks AJA-918 and AJA-919.
const REJECTED_COMMITS = ['50b27fce', '1d102243'];

// If ATONOTA_BACKEND_DIR is set, the source commit is looked up on the `backend` branch.
const backendDir = process.env.ATONOTA_BACKEND_DIR;

describe('sözleşme kopyasının kaynağı', () => {
  it('temiz bir arka uç commit ucundan alınır', () => {
    expect(source.dirty).toBe(false);
    expect(source.commit).toMatch(/^[0-9a-f]{40}$/);
  });

  it.each(REJECTED_COMMITS)('backend dalına girmeyen %s ucundan alınmaz', (prefix) => {
    expect(source.commit.startsWith(prefix)).toBe(false);
  });

  it.skipIf(!backendDir)('kaynak uç backend dalının içindedir', () => {
    // The command fails if the commit is not in the branch.
    execFileSync('git', [
      '-C',
      backendDir as string,
      'merge-base',
      '--is-ancestor',
      source.commit,
      'refs/heads/backend',
    ]);
  });

  it('dosya özetleri SOURCE.json ile aynıdır', () => {
    for (const file of source.files) {
      const hash = createHash('sha256')
        .update(readFileSync(join(contracts, file.path)))
        .digest('hex');
      expect(hash, file.path).toBe(file.sha256);
    }
  });

  // AJA-790: G-62 role and permission endpoints.
  it.each([
    '/platform_core.api.access.explain_permission:',
    '/platform_core.api.access.list_role_permissions:',
    '/platform_core.api.access.set_role_permission:',
    '/platform_core.api.access.remove_role_permission:',
  ])('erişim sözleşmesinde %s ucu vardır', (path) => {
    expect(contract('platform_core-access')).toContain(path);
  });

  // AJA-791: G-98 user invitation, Role Profile assignment and Permission Log.
  it('erişim sözleşmesinde Permission Log ucu vardır', () => {
    expect(contract('platform_core-access')).toContain(
      '/platform_core.api.access.list_permission_logs:',
    );
  });

  it.each([
    '/platform_core.api.identity.invite_user:',
    '/platform_core.api.identity.set_user_role_profiles:',
  ])('kimlik sözleşmesinde %s ucu vardır', (path) => {
    expect(contract('platform_core-identity')).toContain(path);
  });

  // AJA-833: reseller endpoints.
  it.each([
    '/platform_core.api.reseller.list_customers:',
    '/platform_core.api.reseller.customer_status:',
    '/platform_core.api.reseller.request_customer:',
    '/platform_core.api.reseller.approve_customer_request:',
  ])('bayi sözleşmesinde %s ucu vardır', (path) => {
    expect(contract('platform_core-reseller')).toContain(path);
  });
});
