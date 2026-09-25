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
  createTemplateAction,
  executeShellCommand,
} from '@backstage/plugin-scaffolder-node';

/**
 * Installs BMad-METHOD into the task's workspace, via BMad's own real
 * installer (`npx bmad-method install`) in its documented headless-CI form
 * (see the "Headless CI installs" section of BMad's own install docs):
 *
 * ```sh
 * npx bmad-method install --yes --modules <modules> --tools <tools>
 * ```
 *
 * This is what lays down `_bmad/` (config, scripts) and the skill files
 * `bmad:create-product-brief` / `bmad:create-prd` need in place before they
 * can run — BMad's skills are not self-installing, and its scripts
 * (`resolve_config.py`, `memlog.py`, ...) only exist once this has run. Run
 * this as the first step of any BMad creation-wizard template, before the
 * skill-invoking actions.
 *
 * `--tools claude-code` is BMad's own flag for "wire the skills for Claude
 * Code" — it does not launch or depend on this workspace's own use of the
 * Claude Agent SDK; it just determines which skill directories the
 * installer writes so a later run of `bmad:create-product-brief` /
 * `bmad:create-prd` (which invoke skills by name via the Agent SDK's
 * `skills` option) can find them.
 *
 * @public
 */
export function createBmadInstallAction() {
  return createTemplateAction({
    id: 'bmad:install',
    description:
      'Installs BMad-METHOD (via `npx bmad-method install`) into the workspace, so the bmad:create-* actions have _bmad/ and the BMad skills to work with.',
    schema: {
      input: {
        modules: z =>
          z
            .array(z.string())
            .default(['bmm'])
            .describe(
              'BMad modules to install (as accepted by `--modules`). Defaults to just the core BMM module.',
            ),
        tools: z =>
          z
            .array(z.string())
            .default(['claude-code'])
            .describe(
              'AI coding tools to wire BMad skills for (as accepted by `--tools`). Defaults to Claude Code, since that is what bmad:create-* actions invoke via the Claude Agent SDK.',
            ),
        packageVersion: z =>
          z
            .string()
            .optional()
            .describe(
              'Optional npm dist-tag or version for the `bmad-method` package, e.g. "next". Defaults to the `latest` npx resolves.',
            ),
      },
    },
    async handler(ctx) {
      const {
        modules = ['bmm'],
        tools = ['claude-code'],
        packageVersion,
      } = ctx.input;

      const pkg = packageVersion
        ? `bmad-method@${packageVersion}`
        : 'bmad-method';

      ctx.logger.info(
        `Installing BMad-METHOD (${pkg}) into ${ctx.workspacePath} — modules: ${modules.join(', ')}, tools: ${tools.join(', ')}`,
      );

      await executeShellCommand({
        command: 'npx',
        args: [
          '--yes',
          pkg,
          'install',
          '--yes',
          '--modules',
          modules.join(','),
          '--tools',
          tools.join(','),
        ],
        options: { cwd: ctx.workspacePath },
        logger: ctx.logger,
      });
    },
  });
}
