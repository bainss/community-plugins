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

import { parse as parseYaml } from 'yaml';
import type {
  BmadActionItem,
  BmadEpicStatus,
  BmadSprintStatusFacts,
  BmadStoryStatus,
} from '@backstage-community/plugin-bmad-method-common';
import type { RepoFileAccess } from './repoFileAccess';

const STORY_STATUSES: readonly BmadStoryStatus[] = [
  'backlog',
  'ready-for-dev',
  'in-progress',
  'review',
  'done',
];
const EPIC_STATUSES: readonly BmadEpicStatus[] = [
  'backlog',
  'in-progress',
  'done',
];

/** Matches BMad's own key conventions: "epic-1", "epic-12-retrospective", "1-1-user-authentication". */
const EPIC_KEY = /^epic-\d+$/;
const RETROSPECTIVE_KEY = /^epic-\d+-retrospective$/;

/**
 * Parses `sprint-status.yaml` at `implementationArtifactsPath` into typed
 * facts. Real shape confirmed against BMad-METHOD's own
 * `skills/bmad-sprint-planning/sprint-status-template.yaml`: a
 * `development_status` map keyed by epic slug ("epic-1"), retrospective
 * slug ("epic-1-retrospective"), or story slug ("1-1-user-authentication"),
 * plus an `action_items` list.
 *
 * This is intentionally not a strict schema validator — BMad documents this
 * format as an implementation detail of the `bmad-sprint-planning` skill,
 * not a published contract, so anything unrecognized is counted as
 * `'unknown'` rather than rejected, and a totally unparseable file becomes
 * `{ found: true, parseError }` rather than a thrown exception. A missing
 * file is `{ found: false }`, a distinct state a caller needs to tell apart
 * from "parse failed".
 */
export async function parseSprintStatus(
  repo: RepoFileAccess,
  implementationArtifactsPath: string,
  now: Date = new Date(),
): Promise<BmadSprintStatusFacts> {
  const path = joinPath(implementationArtifactsPath, 'sprint-status.yaml');
  const text = await repo.readFile(path);
  if (text === undefined) {
    return {
      found: false,
      storyCountsByStatus: zeroCounts(STORY_STATUSES),
      epicCountsByStatus: zeroCounts(EPIC_STATUSES),
      openActionItems: [],
    };
  }

  let doc: any;
  try {
    doc = parseYaml(text);
  } catch (err) {
    return {
      found: true,
      parseError: err instanceof Error ? err.message : String(err),
      storyCountsByStatus: zeroCounts(STORY_STATUSES),
      epicCountsByStatus: zeroCounts(EPIC_STATUSES),
      openActionItems: [],
    };
  }

  const storyCounts = zeroCounts(STORY_STATUSES);
  const epicCounts = zeroCounts(EPIC_STATUSES);

  const developmentStatus = asRecord(doc?.development_status);
  for (const [key, rawStatus] of Object.entries(developmentStatus)) {
    const status = String(rawStatus);
    if (RETROSPECTIVE_KEY.test(key)) {
      continue; // 'optional' / 'done' on its own scale — not a story or epic count
    }
    if (EPIC_KEY.test(key)) {
      epicCounts[asOneOf(status, EPIC_STATUSES)] += 1;
    } else {
      storyCounts[asOneOf(status, STORY_STATUSES)] += 1;
    }
  }

  const actionItems: BmadActionItem[] = Array.isArray(doc?.action_items)
    ? doc.action_items.map((item: any) => ({
        epic: item?.epic,
        action: String(item?.action ?? ''),
        owner: typeof item?.owner === 'string' ? item.owner : undefined,
        status: asOneOf(String(item?.status ?? ''), [
          'open',
          'in-progress',
          'done',
        ] as const),
      }))
    : [];

  const lastUpdated =
    typeof doc?.last_updated === 'string' ? doc.last_updated : undefined;

  return {
    found: true,
    projectName: typeof doc?.project === 'string' ? doc.project : undefined,
    lastUpdated,
    storyCountsByStatus: storyCounts,
    epicCountsByStatus: epicCounts,
    openActionItems: actionItems.filter(item => item.status !== 'done'),
    ageInDays: ageInDays(lastUpdated, now),
  };
}

function zeroCounts<T extends string>(keys: readonly T[]): Record<T, number> {
  return Object.fromEntries(
    [...keys, 'unknown'].map(k => [k, 0]),
  ) as Record<T, number>;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function asOneOf<T extends string>(
  value: string,
  allowed: readonly T[],
): T | 'unknown' {
  return (allowed as readonly string[]).includes(value)
    ? (value as T)
    : 'unknown';
}

/** BMad-METHOD's own format: "MM-DD-YYYY HH:MM". */
function ageInDays(lastUpdated: string | undefined, now: Date): number | undefined {
  if (!lastUpdated) return undefined;
  const match = lastUpdated.match(
    /^(\d{1,2})-(\d{1,2})-(\d{4})\s+(\d{1,2}):(\d{2})$/,
  );
  if (!match) return undefined;
  const [, month, day, year, hour, minute] = match.map(
    Number as any,
  ) as unknown as number[];
  const parsed = new Date(year, month - 1, day, hour, minute);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return Math.floor((now.getTime() - parsed.getTime()) / (1000 * 60 * 60 * 24));
}

function joinPath(dir: string, file: string): string {
  return `${dir.replace(/\/$/, '')}/${file}`;
}
