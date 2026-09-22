/*
 * Copyright 2026 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { UrlReaderService } from '@backstage/backend-plugin-api';

/**
 * The narrow slice of repo access that `detectBmad` / `resolveBmadConfig` /
 * `parseSprintStatus` actually need. Kept as an explicit boundary — rather
 * than passing `UrlReaderService` straight through — so the parsing logic
 * can be unit tested with a trivial in-memory fake instead of a real repo
 * checkout, and so it never depends on filesystem paths or extraction.
 */
export interface RepoFileAccess {
  /** Returns file contents as a string, or undefined if the file doesn't exist. Never throws on "not found". */
  readFile(path: string): Promise<string | undefined>;
  /**
   * Returns every file path under `dirPath` (recursive), relative to the
   * repo root, or an empty array if the directory doesn't exist. Used to
   * discover `_bmad/**\/module-manifest.toml` without knowing module names
   * up front.
   */
  listFiles(dirPath: string): Promise<string[]>;
}

/** A trivial in-memory implementation, used by this package's own tests. */
export class InMemoryRepoFileAccess implements RepoFileAccess {
  constructor(private readonly files: Record<string, string>) {}

  async readFile(path: string): Promise<string | undefined> {
    return this.files[normalize(path)];
  }

  async listFiles(dirPath: string): Promise<string[]> {
    const prefix = `${normalize(dirPath).replace(/\/$/, '')}/`;
    return Object.keys(this.files).filter(p => normalize(p).startsWith(prefix));
  }
}

/**
 * The real implementation, backed by `UrlReaderService.readTree`. Fetches
 * the entity's source repo tree once (lazily, on first call) and serves
 * both `readFile` and `listFiles` from that in-memory listing, rather than
 * re-fetching per call — a fact retriever handler runs this once per
 * entity per scheduled tick, and each entity's tree is small (a handful of
 * `_bmad/**` files plus one `sprint-status.yaml`), so caching the whole
 * tree for the lifetime of one handler invocation is the right tradeoff.
 */
export class UrlReaderRepoFileAccess implements RepoFileAccess {
  private treeFiles:
    | Promise<{ path: string; content: () => Promise<Buffer> }[]>
    | undefined;

  constructor(
    private readonly urlReader: UrlReaderService,
    /** The entity's resolved source-location URL, e.g. from `ANNOTATION_SOURCE_LOCATION`. */
    private readonly repoUrl: string,
  ) {}

  private async files(): Promise<
    { path: string; content: () => Promise<Buffer> }[]
  > {
    if (!this.treeFiles) {
      this.treeFiles = this.urlReader
        .readTree(this.repoUrl)
        .then(tree => tree.files());
    }
    return this.treeFiles;
  }

  async readFile(path: string): Promise<string | undefined> {
    const normalized = normalize(path);
    const files = await this.files();
    const match = files.find(f => normalize(f.path) === normalized);
    if (!match) return undefined;
    const content = await match.content();
    return content.toString('utf-8');
  }

  async listFiles(dirPath: string): Promise<string[]> {
    const prefix = `${normalize(dirPath).replace(/\/$/, '')}/`;
    const files = await this.files();
    return files
      .map(f => normalize(f.path))
      .filter(p => p.startsWith(prefix));
  }
}

function normalize(path: string): string {
  return path.replace(/^\.\//, '').replace(/\\/g, '/');
}
