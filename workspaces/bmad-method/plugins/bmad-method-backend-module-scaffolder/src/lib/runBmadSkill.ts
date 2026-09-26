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

import { query } from '@anthropic-ai/claude-agent-sdk';
import type { LoggerService } from '@backstage/backend-plugin-api';

/**
 * Runs a single BMad-METHOD skill headlessly via the Claude Agent SDK, in a
 * given working directory, and returns once the run's terminal `result`
 * message has been observed.
 *
 * This is deliberately a thin wrapper: it does not know anything about a
 * particular skill's headless input/output contract (see
 * `parseHeadlessStatus` and the individual actions for that) — it only
 * knows how to start an SDK `query()` scoped to one skill, drain it to
 * completion, and surface the final result in a shape the actions can work
 * with.
 *
 * @public
 */
export interface RunBmadSkillOptions {
  /** SKILL.md `name` / directory name of the BMad skill to run, e.g. `"bmad-product-brief"`. */
  skill: string;
  /**
   * Working directory for the run. This should be the target repo/workspace
   * root — the one BMad's own `{project-root}` convention resolves against,
   * and where `_bmad/` (its scripts and per-skill customization) lives.
   */
  cwd: string;
  /** The first (and, for a headless run, only) user message — see each skill's own headless-mode contract for what it expects here. */
  prompt: string;
  /** Overrides the SDK's default model, when set. */
  model?: string;
  /**
   * Optional environment-variable overlay for the Claude Code CLI
   * subprocess this spawns, merged on top of this process's own
   * environment — typically the output of `resolveAiEnv`, used to route
   * this run through a specific AI provider (e.g. Microsoft Foundry)
   * rather than whatever ANTHROPIC_* variables the backend process itself
   * happens to have set. When omitted, the subprocess inherits this
   * process's environment unchanged, exactly as before this option
   * existed.
   */
  env?: Record<string, string>;
  logger?: LoggerService;
  /** Aborts the run (and the underlying Claude Code subprocess) when triggered. */
  abortSignal?: AbortSignal;
}

export interface RunBmadSkillResult {
  /** The final assistant turn's text — expected to end with the skill's headless JSON status block. */
  resultText: string;
  /** True when the run itself completed but ended in an API/turn error (see the SDK's `is_error` on a `success`-subtype result). */
  isError: boolean;
  totalCostUsd: number;
  sessionId: string;
  numTurns: number;
}

/**
 * Thrown when the run never reaches a successful `result` message — the SDK
 * reported a startup failure, hit `max_turns`/`max_budget_usd`, or was
 * aborted before completing. Distinct from a *successful* run whose skill
 * decided to report `status: "blocked"` in its own JSON — that is a normal
 * outcome the caller should parse and act on, not a thrown error.
 */
export class BmadSkillRunError extends Error {
  constructor(
    message: string,
    readonly details: { subtype: string; errors?: string[] },
  ) {
    super(message);
    this.name = 'BmadSkillRunError';
  }
}

/**
 * Merges an optional environment overlay on top of this process's own
 * environment, for the Claude Code CLI subprocess the Agent SDK spawns.
 * Returns `undefined` when there is no overlay, so `query()` falls back to
 * its own default (inherit `process.env` as-is) rather than this function
 * re-implementing that default and risking a subtle mismatch with the SDK's
 * own behavior.
 *
 * When the overlay configures Microsoft Foundry (any `ANTHROPIC_FOUNDRY_*`
 * key), a plain `ANTHROPIC_API_KEY` inherited from this process's own
 * environment is dropped from the merged result — Foundry and the direct
 * Anthropic API are alternative auth paths for the same Claude Code CLI
 * subprocess, and leaving both set would make it ambiguous which one the
 * CLI actually used for this run.
 */
function buildSubprocessEnv(
  overrides?: Record<string, string>,
): NodeJS.ProcessEnv | undefined {
  if (!overrides) {
    return undefined;
  }

  const merged: NodeJS.ProcessEnv = { ...process.env };
  const usesFoundry = Object.keys(overrides).some(key =>
    key.startsWith('ANTHROPIC_FOUNDRY_'),
  );
  if (usesFoundry) {
    delete merged.ANTHROPIC_API_KEY;
  }

  return { ...merged, ...overrides };
}

export async function runBmadSkill(
  options: RunBmadSkillOptions,
): Promise<RunBmadSkillResult> {
  const { skill, cwd, prompt, model, env, logger, abortSignal } = options;

  const abortController = new AbortController();
  if (abortSignal) {
    if (abortSignal.aborted) {
      abortController.abort();
    } else {
      abortSignal.addEventListener('abort', () => abortController.abort());
    }
  }

  const run = query({
    prompt,
    options: {
      cwd,
      model,
      skills: [skill],
      // Unattended backend run: there is no human present to approve each
      // tool call BMad's own scripts and file writes make.
      permissionMode: 'bypassPermissions',
      // Load the target repo's own `.claude/settings.json` / CLAUDE.md
      // (BMad installs its own project-level config there), but not the
      // operator's personal user-level settings.
      settingSources: ['project'],
      env: buildSubprocessEnv(env),
      abortController,
      stderr: data => logger?.debug(`[bmad:${skill}] stderr: ${data}`),
    },
  });

  let finalResult:
    | Awaited<ReturnType<typeof run.next>>['value']
    | undefined;
  for await (const message of run) {
    if (message.type === 'result') {
      finalResult = message;
    }
    logger?.debug(`[bmad:${skill}] sdk message: ${message.type}`);
  }

  if (!finalResult || finalResult.type !== 'result') {
    throw new BmadSkillRunError(
      `bmad skill "${skill}" ended without a result message`,
      { subtype: 'no_result' },
    );
  }

  if (finalResult.subtype !== 'success') {
    throw new BmadSkillRunError(
      `bmad skill "${skill}" run failed (${finalResult.subtype})`,
      { subtype: finalResult.subtype, errors: finalResult.errors },
    );
  }

  return {
    resultText: finalResult.result,
    isError: finalResult.is_error,
    totalCostUsd: finalResult.total_cost_usd,
    sessionId: finalResult.session_id,
    numTurns: finalResult.num_turns,
  };
}
