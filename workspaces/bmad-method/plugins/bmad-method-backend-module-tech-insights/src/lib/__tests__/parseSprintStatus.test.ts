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
import { parseSprintStatus } from '../parseSprintStatus';

// Real fixture copied verbatim from bmad-code-org/BMAD-METHOD
// skills/bmad-sprint-planning/sprint-status-template.yaml — BMad's own
// documented example of the shape, not a guess.
const FIXTURE = readFileSync(
  join(__dirname, '../__fixtures__/sprint-status-template.yaml'),
  'utf-8',
);

const IMPLEMENTATION_ARTIFACTS = '_bmad-output/implementation-artifacts';

describe('parseSprintStatus', () => {
  it('returns found:false when the file does not exist', async () => {
    const repo = new InMemoryRepoFileAccess({});
    const facts = await parseSprintStatus(repo, IMPLEMENTATION_ARTIFACTS);
    expect(facts.found).toBe(false);
    expect(facts.storyCountsByStatus.done).toBe(0);
  });

  it('parses the real BMad sprint-status.yaml shape', async () => {
    const repo = new InMemoryRepoFileAccess({
      [`${IMPLEMENTATION_ARTIFACTS}/sprint-status.yaml`]: FIXTURE,
    });

    const facts = await parseSprintStatus(
      repo,
      IMPLEMENTATION_ARTIFACTS,
      new Date('2026-09-22T00:00:00Z'),
    );

    expect(facts.found).toBe(true);
    expect(facts.parseError).toBeUndefined();
    expect(facts.projectName).toBe('My Awesome Project');

    // epic-1 and epic-2 are both 'backlog'; epic-*-retrospective keys are excluded
    expect(facts.epicCountsByStatus).toEqual({
      backlog: 2,
      'in-progress': 0,
      done: 0,
      unknown: 0,
    });

    // 1-1 done, 1-2 ready-for-dev, the rest (1-3, 1-4, 2-1, 2-2, 2-3) backlog
    expect(facts.storyCountsByStatus).toEqual({
      backlog: 5,
      'ready-for-dev': 1,
      'in-progress': 0,
      review: 0,
      done: 1,
      unknown: 0,
    });

    expect(facts.openActionItems).toHaveLength(1);
    expect(facts.openActionItems[0]).toMatchObject({
      epic: 1,
      owner: 'Charlie',
      status: 'open',
    });

    // last_updated is "05-06-2025 21:30" — well over a year before the fixed `now` above
    expect(facts.ageInDays).toBeGreaterThan(300);
  });

  it('degrades to parseError rather than throwing on invalid YAML', async () => {
    const repo = new InMemoryRepoFileAccess({
      [`${IMPLEMENTATION_ARTIFACTS}/sprint-status.yaml`]: '{ not: valid: yaml: [',
    });

    const facts = await parseSprintStatus(repo, IMPLEMENTATION_ARTIFACTS);

    expect(facts.found).toBe(true);
    expect(facts.parseError).toBeDefined();
    expect(facts.storyCountsByStatus.done).toBe(0);
  });

  it('closes open action items when marked done, and excludes them from openActionItems', async () => {
    const yaml = `
development_status:
  epic-1: done
action_items:
  - epic: 1
    action: Something already fixed
    owner: Alex
    status: done
`;
    const repo = new InMemoryRepoFileAccess({
      [`${IMPLEMENTATION_ARTIFACTS}/sprint-status.yaml`]: yaml,
    });

    const facts = await parseSprintStatus(repo, IMPLEMENTATION_ARTIFACTS);
    expect(facts.openActionItems).toHaveLength(0);
  });
});
