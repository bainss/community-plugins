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

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { InMemoryRepoFileAccess } from '../repoFileAccess';
import { detectBmad } from '../detectBmad';

// Real fixtures copied verbatim from bmad-code-org/BMAD-METHOD:
//   skills/bmad/assets/config.template.toml
//   skills/bmad-sprint-planning/module-manifest.toml
const CONFIG_TEMPLATE = readFileSync(
  join(__dirname, '../__fixtures__/config.template.toml'),
  'utf-8',
);
const MODULE_MANIFEST = readFileSync(
  join(__dirname, '../__fixtures__/module-manifest-sample.toml'),
  'utf-8',
);

const REPO_ROOT = '/repos/example-project';

describe('detectBmad', () => {
  it('reports not installed when _bmad/config.toml is absent', async () => {
    const repo = new InMemoryRepoFileAccess({});
    const facts = await detectBmad(repo, REPO_ROOT);
    expect(facts).toEqual({ bmadInstalled: false, bmadModules: [] });
  });

  it('detects installation and resolves default artifact paths from the real config template', async () => {
    const repo = new InMemoryRepoFileAccess({
      '_bmad/config.toml': CONFIG_TEMPLATE,
      '_bmad/bmad-sprint-planning/module-manifest.toml': MODULE_MANIFEST,
    });

    const facts = await detectBmad(repo, REPO_ROOT);

    expect(facts.bmadInstalled).toBe(true);
    expect(facts.bmadModules).toEqual(['method']); // from the real module-manifest.toml fixture
    expect(facts.configParseError).toBeUndefined();

    // config.template.toml's defaults, with {project-root} substituted.
    expect(facts.resolvedConfig?.planningArtifactsPath).toBe(
      `${REPO_ROOT}/_bmad-output/planning-artifacts`,
    );
    expect(facts.resolvedConfig?.implementationArtifactsPath).toBe(
      `${REPO_ROOT}/_bmad-output/implementation-artifacts`,
    );
    expect(facts.resolvedConfig?.projectKnowledgePath).toBe(
      `${REPO_ROOT}/docs`,
    );
  });

  it('applies a team override the way "Adopt BMad Across a Team" documents it', async () => {
    // Real example from docs/customize/adopt-bmad-across-a-team.md
    const teamOverride = `
[modules.bmm]
planning_artifacts = "{project-root}/shared/planning"
implementation_artifacts = "{project-root}/shared/implementation"
`;
    const repo = new InMemoryRepoFileAccess({
      '_bmad/config.toml': CONFIG_TEMPLATE,
      '_bmad/custom/config.toml': teamOverride,
    });

    const facts = await detectBmad(repo, REPO_ROOT);

    expect(facts.resolvedConfig?.planningArtifactsPath).toBe(
      `${REPO_ROOT}/shared/planning`,
    );
    expect(facts.resolvedConfig?.implementationArtifactsPath).toBe(
      `${REPO_ROOT}/shared/implementation`,
    );
  });

  it('does not let one unreadable manifest hide modules from a readable one', async () => {
    const repo = new InMemoryRepoFileAccess({
      '_bmad/config.toml': CONFIG_TEMPLATE,
      '_bmad/broken/module-manifest.toml': 'not = [valid toml',
      '_bmad/bmad-sprint-planning/module-manifest.toml': MODULE_MANIFEST,
    });

    const facts = await detectBmad(repo, REPO_ROOT);
    expect(facts.bmadModules).toEqual(['method']);
  });
});
