export const REPOSITORY: 'metafrappe/backend';

export interface CommitInfo {
  commit: string;
  dirty: boolean;
  origin: 'git' | 'SOURCE_COMMIT';
}

export interface ManifestFile {
  path: string;
  sha256: string;
}

export interface Manifest {
  repository: typeof REPOSITORY;
  commit: string;
  dirty: boolean;
  commitSource: CommitInfo['origin'];
  files: ManifestFile[];
}

export interface RunResult {
  ok: boolean;
  problems: string[];
  manifest: Manifest;
  written?: string;
}

export function readCommit(source: string): CommitInfo;
export function run(argv?: string[]): RunResult;
