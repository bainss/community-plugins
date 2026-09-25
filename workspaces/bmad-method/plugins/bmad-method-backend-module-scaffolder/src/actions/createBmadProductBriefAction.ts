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
 * Runs BMad-METHOD's `bmad-product-brief` skill headlessly (via the Claude
 * Agent SDK) to turn a free-text product idea into a `brief.md`, in the
 * task's workspace.
 *
 * Requires `bmad:install` (or an equivalent) to have already put `_bmad/`
 * and the `bmad-product-brief` skill files in place in the same workspace —
 * this action does not install BMad itself.
 *
 * Per BMad's own headless-mode contract (see the skill's inline "Headless
 * Mode" section), the skill infers what it can and records the rest as
 * `assumptions` / `open_questions` rather than asking — this is what makes
 * it usable unattended from a Scaffolder step. Output includes those, so a
 * review step further down the template can surface them for a human
 * before the brief is treated as final.
 *
 * @public
 */
export function createBmadProductBriefAction() {
  return createTemplateAction({
    id: 'bmad:create-product-brief',
    description:
      "Runs BMad-METHOD's bmad-product-brief skill headlessly to draft a product brief from a free-text idea.",
    schema: {
      input: {
        productIdea: z =>
          z
            .string()
            .describe(
              'Free-text description of the product idea — the "brain dump" the skill would otherwise draw out conversationally.',
            ),
        projectName: z =>
          z.string().optional().describe('Working name for the product, if known.'),
        notes: z =>
          z
            .string()
            .optional()
            .describe(
              'Any additional scope, audience, or constraint notes to pass along verbatim.',
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
        briefPath: z =>
          z.string().optional().describe('Workspace-relative path to the generated brief.md.'),
        addendumPath: z => z.string().optional(),
        memlogPath: z => z.string().optional(),
        openQuestions: z => z.array(z.string()).optional(),
        assumptions: z => z.array(z.string()).optional(),
      },
    },
    async handler(ctx) {
      const { productIdea, projectName, notes, model } = ctx.input;

      const promptLines = [
        'headless: true',
        'intent: create',
        projectName ? `project_name: ${projectName}` : undefined,
        'idea:',
        productIdea,
        notes ? `notes:\n${notes}` : undefined,
      ].filter((line): line is string => Boolean(line));

      ctx.logger.info('Running bmad-product-brief headlessly...');

      const run = await runBmadSkill({
        skill: 'bmad-product-brief',
        cwd: ctx.workspacePath,
        prompt: promptLines.join('\n'),
        model,
        logger: ctx.logger,
        abortSignal: ctx.signal,
      });

      if (run.isError) {
        throw new Error(
          `bmad-product-brief run ended in an error: ${run.resultText}`,
        );
      }

      const parsed = parseHeadlessStatus(run.resultText);
      if (!parsed) {
        throw new Error(
          'bmad-product-brief finished but did not end with a parseable headless status block. ' +
            `Raw output:\n${run.resultText}`,
        );
      }

      if (parsed.status === 'blocked') {
        throw new Error(
          `bmad-product-brief could not produce a brief: ${parsed.reason ?? 'no reason given'}`,
        );
      }

      if (parsed.openQuestions?.length) {
        ctx.logger.warn(
          `bmad-product-brief left ${parsed.openQuestions.length} open question(s) for review: ${parsed.openQuestions.join(' | ')}`,
        );
      }

      ctx.output('status', parsed.status);
      if (parsed.brief) {
        ctx.output('briefPath', parsed.brief);
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
