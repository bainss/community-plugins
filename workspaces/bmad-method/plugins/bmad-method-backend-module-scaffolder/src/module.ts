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

import { createBackendModule } from '@backstage/backend-plugin-api';
import { scaffolderActionsExtensionPoint } from '@backstage/plugin-scaffolder-node';
import { createBmadInstallAction } from './actions/createBmadInstallAction';
import { createBmadProductBriefAction } from './actions/createBmadProductBriefAction';
import { createBmadPrdAction } from './actions/createBmadPrdAction';

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
 * @public
 */
export const bmadMethodModuleScaffolder = createBackendModule({
  pluginId: 'scaffolder',
  moduleId: 'bmad-method',
  register(env) {
    env.registerInit({
      deps: {
        scaffolderActions: scaffolderActionsExtensionPoint,
      },
      async init({ scaffolderActions }) {
        scaffolderActions.addActions(
          createBmadInstallAction(),
          createBmadProductBriefAction(),
          createBmadPrdAction(),
        );
      },
    });
  },
});
