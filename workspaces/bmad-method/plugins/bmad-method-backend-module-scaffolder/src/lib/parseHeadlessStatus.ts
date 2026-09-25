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

import { BmadHeadlessStatus } from '@backstage-community/plugin-bmad-method-common';

const STATUS_VALUES = new Set(['complete', 'partial', 'blocked']);
const INTENT_VALUES = new Set(['create', 'update', 'validate']);

/**
 * Finds the last fenced ```json ... ``` (or bare ```` ``` ````) code block in
 * `text`, if any.
 */
function lastFencedBlock(text: string): string | undefined {
  const fenceRe = /```(?:json)?\s*\n?([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  let last: string | undefined;
  while ((match = fenceRe.exec(text))) {
    last = match[1];
  }
  return last;
}

/**
 * Finds the last balanced top-level `{ ... }` object in `text` by scanning
 * from the end, tracking brace depth (naively — good enough for the JSON
 * BMad skills emit, which don't contain unescaped braces inside strings in
 * practice; a full JSON tokenizer would be overkill here).
 */
function lastBalancedObject(text: string): string | undefined {
  const end = text.lastIndexOf('}');
  if (end === -1) {
    return undefined;
  }
  let depth = 0;
  for (let i = end; i >= 0; i--) {
    const char = text[i];
    if (char === '}') {
      depth++;
    } else if (char === '{') {
      depth--;
      if (depth === 0) {
        return text.slice(i, end + 1);
      }
    }
  }
  return undefined;
}

/**
 * Raw JSON shape as the BMad skills document it (snake_case, per
 * `references/headless.md` / `assets/headless-schemas.md`), before mapping
 * onto this plugin's camelCase {@link BmadHeadlessStatus}.
 */
interface RawHeadlessStatus {
  status?: unknown;
  intent?: unknown;
  reason?: unknown;
  assumptions?: unknown;
  open_questions?: unknown;
  brief?: unknown;
  prd?: unknown;
  addendum?: unknown;
  memlog?: unknown;
  validation_report?: unknown;
  offer_to_update?: unknown;
  changes_summary?: unknown;
  conflicts_with_prior_decisions?: unknown;
  external_handoffs?: unknown;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value.filter((item): item is string => typeof item === 'string');
}

/**
 * Parses a BMad skill's end-of-run headless status block out of the free
 * text a `query()` run returned (or, when structured output was requested
 * and honored, the object itself). BMad skills are prompted to "end with
 * the JSON response" but are free to wrap it in prose or a fenced code
 * block — this looks for a fenced block first, then falls back to the last
 * balanced `{...}` in the text, since a skill run late in a long
 * conversation may otherwise contain earlier, unrelated JSON.
 *
 * Returns `undefined` (never throws) when no parseable, minimally-shaped
 * status object can be found — callers should treat that as "the skill run
 * finished without producing its documented contract" and surface it as a
 * failure, not silently proceed as if nothing was produced.
 */
export function parseHeadlessStatus(
  resultTextOrStructuredOutput: string | unknown,
): BmadHeadlessStatus | undefined {
  let candidate: unknown = resultTextOrStructuredOutput;

  if (typeof resultTextOrStructuredOutput === 'string') {
    const text = resultTextOrStructuredOutput;
    const sources = [lastFencedBlock(text), lastBalancedObject(text), text];
    candidate = undefined;
    for (const source of sources) {
      if (!source) {
        continue;
      }
      try {
        candidate = JSON.parse(source);
        break;
      } catch {
        // try the next, less-specific source
      }
    }
  }

  if (typeof candidate !== 'object' || candidate === null) {
    return undefined;
  }

  const raw = candidate as RawHeadlessStatus;
  if (
    typeof raw.status !== 'string' ||
    !STATUS_VALUES.has(raw.status) ||
    typeof raw.intent !== 'string' ||
    !INTENT_VALUES.has(raw.intent)
  ) {
    return undefined;
  }

  const externalHandoffs = Array.isArray(raw.external_handoffs)
    ? raw.external_handoffs
        .filter(
          (item): item is Record<string, unknown> =>
            typeof item === 'object' && item !== null,
        )
        .map(item => ({
          directive: typeof item.directive === 'string' ? item.directive : '',
          tool: typeof item.tool === 'string' ? item.tool : undefined,
          url: typeof item.url === 'string' ? item.url : undefined,
          status: typeof item.status === 'string' ? item.status : 'unknown',
        }))
    : undefined;

  return {
    status: raw.status as BmadHeadlessStatus['status'],
    intent: raw.intent as BmadHeadlessStatus['intent'],
    reason: typeof raw.reason === 'string' ? raw.reason : undefined,
    assumptions: asStringArray(raw.assumptions),
    openQuestions: asStringArray(raw.open_questions),
    brief: typeof raw.brief === 'string' ? raw.brief : undefined,
    prd: typeof raw.prd === 'string' ? raw.prd : undefined,
    addendum: typeof raw.addendum === 'string' ? raw.addendum : undefined,
    memlog: typeof raw.memlog === 'string' ? raw.memlog : undefined,
    validationReport:
      typeof raw.validation_report === 'string'
        ? raw.validation_report
        : undefined,
    offerToUpdate:
      typeof raw.offer_to_update === 'boolean' ? raw.offer_to_update : undefined,
    changesSummary:
      typeof raw.changes_summary === 'string' ? raw.changes_summary : undefined,
    conflictsWithPriorDecisions: asStringArray(
      raw.conflicts_with_prior_decisions,
    ),
    externalHandoffs,
  };
}
