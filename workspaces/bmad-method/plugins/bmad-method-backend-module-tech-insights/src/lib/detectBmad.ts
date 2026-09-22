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

import * as TOML from '@iarna/toml';
import type { BmadAdoptionFacts } from '@backstage-community/plugin-bmad-method-common';
import type { RepoFileAccess } from './repoFileAccess';
import { resolveBmadConfig } from './resolveBmadConfig';

/**
 * Detects whether a repo has BMad-METHOD installed and which modules it
 * uses. This is deliberately cheap and defensive: it runs once per catalog
 * entity on the fact retriever's schedule, so a missing or malformed file
 * should never throw — it should just contribute less information.
 *
 * @param repoRootAbsolutePath - used only to resolve `{project-root}`
 *   tokens in config paths; this function does not read anything outside
 *   the repo, it's a display/config-resolution concern.
 */
export async function detectBmad(
  repo: RepoFileAccess,
  repoRootAbsolutePath: string,
): Promise<BmadAdoptionFacts> {
  const baselineText = await repo.readFile('_bmad/config.toml');
  if (baselineText === undefined) {
    return { bmadInstalled: false, bmadModules: [] };
  }

  const { config, baselineParseError } = await resolveBmadConfig(
    repo,
    repoRootAbsolutePath,
  );

  const manifestPaths = (await repo.listFiles('_bmad')).filter(p =>
    p.endsWith('module-manifest.toml'),
  );

  const modules = new Set<string>();
  for (const path of manifestPaths) {
    const text = await repo.readFile(path);
    if (!text) continue;
    try {
      const parsed = TOML.parse(text) as Record<string, unknown>;
      if (typeof parsed.module === 'string') {
        modules.add(parsed.module);
      }
    } catch {
      // One unreadable manifest shouldn't hide the modules we could read.
    }
  }

  return {
    bmadInstalled: true,
    bmadModules: [...modules].sort(),
    resolvedConfig: config,
    configParseError: baselineParseError,
  };
}
