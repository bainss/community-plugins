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
import type { BmadResolvedConfig } from '@backstage-community/plugin-bmad-method-common';
import type { RepoFileAccess } from './repoFileAccess';

/**
 * Resolves BMad's central config for a repo, following the precedence
 * documented in BMad-METHOD's "Adopt BMad Across a Team" guide:
 *
 *   _bmad/config.toml             (installer-managed baseline)
 *   _bmad/custom/config.toml      (team override, committed — scalars win over baseline)
 *   _bmad/custom/config.user.toml (personal override, gitignored — scalars win over team)
 *
 * Only scalar [core]/[modules.bmm] keys are merged here (path overrides are
 * always scalars in BMad's own docs); array-of-table merge rules that apply
 * to agent/workflow customization elsewhere are out of scope for config
 * resolution and deliberately not implemented here.
 *
 * Returns an empty result if `_bmad/config.toml` itself doesn't exist (BMad
 * not installed, or installed with a layout this module doesn't recognize).
 * Never throws — a parse failure on any file is treated as "that file
 * contributes nothing", so detection can still say "installed, details
 * unknown" via `baselineParseError` instead of failing the whole retriever
 * run for one entity.
 */
export async function resolveBmadConfig(
  repo: RepoFileAccess,
  repoRootAbsolutePath: string,
): Promise<{ config?: BmadResolvedConfig; baselineParseError?: string }> {
  const baselineText = await repo.readFile('_bmad/config.toml');
  if (baselineText === undefined) {
    return {};
  }

  let baseline: Record<string, unknown>;
  try {
    baseline = TOML.parse(baselineText) as Record<string, unknown>;
  } catch (err) {
    return { baselineParseError: describeError(err) };
  }

  const overrides: Record<string, unknown>[] = [];
  for (const path of [
    '_bmad/custom/config.toml',
    '_bmad/custom/config.user.toml',
  ]) {
    const text = await repo.readFile(path);
    if (text === undefined) continue;
    try {
      overrides.push(TOML.parse(text) as Record<string, unknown>);
    } catch {
      // A broken override file contributes nothing rather than aborting
      // resolution — the baseline is still usable, which matters more for
      // detection purposes than surfacing this specific parse error.
    }
  }

  const merged = mergeScalarSections(baseline, overrides);
  const core = (merged.core as Record<string, unknown>) ?? {};
  const bmm = (merged.modules as Record<string, unknown>)?.bmm as
    | Record<string, unknown>
    | undefined;

  const substitute = (value: unknown): string | undefined =>
    typeof value === 'string'
      ? value.replace(/\{project-root\}/g, repoRootAbsolutePath)
      : undefined;

  const planningArtifactsPath =
    substitute(bmm?.planning_artifacts) ??
    `${repoRootAbsolutePath}/_bmad-output/planning-artifacts`; // config.template.toml default

  const implementationArtifactsPath =
    substitute(bmm?.implementation_artifacts) ??
    `${repoRootAbsolutePath}/_bmad-output/implementation-artifacts`; // config.template.toml default

  return {
    config: {
      projectName:
        typeof core.project_name === 'string' ? core.project_name : undefined,
      planningArtifactsPath,
      implementationArtifactsPath,
      projectKnowledgePath: substitute(bmm?.project_knowledge),
    },
  };
}

/**
 * Shallow-merges [core] and [modules.bmm] scalar keys, override wins, later
 * overrides in `overrides` win over earlier ones. Deliberately does not
 * attempt BMad's full array-of-tables merge rules (agents, workflow
 * arrays) — config resolution only needs the path scalars.
 */
function mergeScalarSections(
  baseline: Record<string, unknown>,
  overrides: Record<string, unknown>[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {
    core: { ...(baseline.core as object) },
    modules: {
      bmm: { ...((baseline.modules as any)?.bmm as object) },
    },
  };
  for (const override of overrides) {
    if (override.core) {
      Object.assign(result.core as object, override.core);
    }
    const overrideBmm = (override.modules as any)?.bmm;
    if (overrideBmm) {
      Object.assign((result.modules as any).bmm, overrideBmm);
    }
  }
  return result;
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
