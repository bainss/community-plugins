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
import { UrlReaderRepoFileAccess } from '../repoFileAccess';

/** A minimal fake of the one UrlReaderService method this adapter uses. */
function fakeUrlReader(files: Record<string, string>): UrlReaderService {
  let treeCalls = 0;
  return {
    readUrl: jest.fn(),
    readTree: jest.fn(async () => {
      treeCalls += 1;
      return {
        files: async () =>
          Object.entries(files).map(([path, content]) => ({
            path,
            content: async () => Buffer.from(content, 'utf-8'),
            lastModifiedAt: undefined,
          })),
        archive: jest.fn(),
        dir: jest.fn(),
        etag: '',
      };
    }),
    search: jest.fn(),
    readTreeCallCount: () => treeCalls,
  } as unknown as UrlReaderService & { readTreeCallCount: () => number };
}

describe('UrlReaderRepoFileAccess', () => {
  it('reads an existing file and returns undefined for a missing one', async () => {
    const reader = fakeUrlReader({
      '_bmad/config.toml': '[core]\nproject_name = "demo"',
    });
    const repo = new UrlReaderRepoFileAccess(reader, 'https://example/repo');

    expect(await repo.readFile('_bmad/config.toml')).toContain('demo');
    expect(await repo.readFile('nope.toml')).toBeUndefined();
  });

  it('lists files under a directory prefix', async () => {
    const reader = fakeUrlReader({
      '_bmad/config.toml': 'a',
      '_bmad/sub/module-manifest.toml': 'b',
      'README.md': 'c',
    });
    const repo = new UrlReaderRepoFileAccess(reader, 'https://example/repo');

    expect((await repo.listFiles('_bmad')).sort()).toEqual([
      '_bmad/config.toml',
      '_bmad/sub/module-manifest.toml',
    ]);
  });

  it('fetches the tree only once across multiple reads', async () => {
    const reader = fakeUrlReader({ '_bmad/config.toml': 'a' });
    const repo = new UrlReaderRepoFileAccess(reader, 'https://example/repo');

    await repo.readFile('_bmad/config.toml');
    await repo.listFiles('_bmad');
    await repo.readFile('_bmad/config.toml');

    expect(reader.readTree).toHaveBeenCalledTimes(1);
  });
});
