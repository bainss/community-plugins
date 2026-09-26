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

import {
  coreServices,
  createBackendModule,
} from '@backstage/backend-plugin-api';
import { scaffolderActionsExtensionPoint } from '@backstage/plugin-scaffolder-node';
import { createBmadInstallAction } from './actions/createBmadInstallAction';
import { createBmadProductBriefAction } from './actions/createBmadProductBriefAction';
import { createBmadPrdAction } from './actions/createBmadPrdAction';
import { resolveAiEnv } from './lib/resolveAiEnv';

/**
 * Registers three Scaffolder actions that drive BMad-METHOD's creation
 * skills headlessly (via the Claude Agent SDK) from a template:
 *
 * - `bmad:install` — lays down `_bmad/` and the BMad skill files.
 * - `bmad:create-product-brief` — idea in, `brief.md` out.
 * - `bmad:create-prd` — brief in, `prd.md` out.
 *
 * Install this backend module alongside `@backstage/plugin-scaffolder-backend`.
 * A template wires these together as steps, with a human review step
 * between each creation action and the next — see the workspace README for
 * the recommended template shape.
 *
 * The two skill-invoking actions pick up an optional `bmadMethod.ai` config
 * block (see `config.d.ts` / `resolveAiEnv`) to choose an AI provider —
 * direct Anthropic API or Microsoft Foundry — per deployment. With no such
 * config, they fall back to whatever ANTHROPIC_* variables are already on
 * this backend process's own environment, unchanged from before this
 * option existed.
 *
 * @public
 */
export const bmadMethodModuleScaffolder = createBackendModule({
  pluginId: 'scaffolder',
  moduleId: 'bmad-method',
  register(env) {
    env.registerInit({
      deps: {
        scaffolderActions: scaffolderActionsExtensionPoint,
        config: coreServices.rootConfig,
      },
      async init({ scaffolderActions, config }) {
        const aiEnv = resolveAiEnv(config);
        scaffolderActions.addActions(
          createBmadInstallAction(),
          createBmadProductBriefAction({ env: aiEnv }),
          createBmadPrdAction({ env: aiEnv }),
        );
      },
    });
  },
});
