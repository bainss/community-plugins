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

import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { parseHeadlessStatus } from '../lib/parseHeadlessStatus';
import { runBmadSkill } from '../lib/runBmadSkill';

/**
 * Runs BMad-METHOD's `bmad-prd` skill headlessly (via the Claude Agent SDK)
 * to turn a product brief into a PRD, in the task's workspace.
 *
 * Requires `bmad:install` to have already put `_bmad/` and the `bmad-prd`
 * skill files in place, and expects `briefPath` to point at a `brief.md`
 * already present in the same workspace — normally the `briefPath` output
 * of a preceding `bmad:create-product-brief` step in the same template.
 *
 * @public
 */
export function createBmadPrdAction() {
  return createTemplateAction({
    id: 'bmad:create-prd',
    description:
      "Runs BMad-METHOD's bmad-prd skill headlessly to draft a PRD from an existing product brief.",
    schema: {
      input: {
        briefPath: z =>
          z
            .string()
            .describe(
              'Workspace-relative (or absolute, within the workspace) path to the brief.md to work from — typically the briefPath output of a preceding bmad:create-product-brief step.',
            ),
        notes: z =>
          z
            .string()
            .optional()
            .describe(
              'Any additional scope notes to pass along verbatim (e.g. answers to the brief\'s open questions).',
            ),
        model: z =>
          z
            .string()
            .optional()
            .describe(
              'Overrides the Claude model used for this run. Defaults to the Agent SDK/CLI default.',
            ),
      },
      output: {
        status: z =>
          z
            .enum(['complete', 'partial', 'blocked'])
            .describe('The skill\'s own headless-run status.'),
        prdPath: z =>
          z.string().optional().describe('Workspace-relative path to the generated prd.md.'),
        addendumPath: z => z.string().optional(),
        memlogPath: z => z.string().optional(),
        openQuestions: z => z.array(z.string()).optional(),
        assumptions: z => z.array(z.string()).optional(),
      },
    },
    async handler(ctx) {
      const { briefPath, notes, model } = ctx.input;

      const promptLines = [
        'headless: true',
        'intent: create',
        `brief: ${briefPath}`,
        notes ? `notes:\n${notes}` : undefined,
      ].filter((line): line is string => Boolean(line));

      ctx.logger.info('Running bmad-prd headlessly...');

      const run = await runBmadSkill({
        skill: 'bmad-prd',
        cwd: ctx.workspacePath,
        prompt: promptLines.join('\n'),
        model,
        logger: ctx.logger,
        abortSignal: ctx.signal,
      });

      if (run.isError) {
        throw new Error(`bmad-prd run ended in an error: ${run.resultText}`);
      }

      const parsed = parseHeadlessStatus(run.resultText);
      if (!parsed) {
        throw new Error(
          'bmad-prd finished but did not end with a parseable headless status block. ' +
            `Raw output:\n${run.resultText}`,
        );
      }

      if (parsed.status === 'blocked') {
        throw new Error(
          `bmad-prd could not produce a PRD: ${parsed.reason ?? 'no reason given'}`,
        );
      }

      if (parsed.openQuestions?.length) {
        ctx.logger.warn(
          `bmad-prd left ${parsed.openQuestions.length} open question(s) for review: ${parsed.openQuestions.join(' | ')}`,
        );
      }

      ctx.output('status', parsed.status);
      if (parsed.prd) {
        ctx.output('prdPath', parsed.prd);
      }
      if (parsed.addendum) {
        ctx.output('addendumPath', parsed.addendum);
      }
      if (parsed.memlog) {
        ctx.output('memlogPath', parsed.memlog);
      }
      if (parsed.openQuestions) {
        ctx.output('openQuestions', parsed.openQuestions);
      }
      if (parsed.assumptions) {
        ctx.output('assumptions', parsed.assumptions);
      }
    },
  });
}
