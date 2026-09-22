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

import { CatalogClient } from '@backstage/catalog-client';
import { Entity } from '@backstage/catalog-model';
import {
  FactRetriever,
  FactRetrieverContext,
  TechInsightFact,
} from '@backstage-community/plugin-tech-insights-node';
import { detectBmad } from '../lib/detectBmad';
import { parseSprintStatus } from '../lib/parseSprintStatus';
import { getEntityRepoUrl } from '../lib/getEntityRepoUrl';
import { UrlReaderRepoFileAccess } from '../lib/repoFileAccess';

/**
 * Reports sprint/epic status counts and open action items from an entity's
 * `sprint-status.yaml`, as produced by BMad-METHOD's `bmad-sprint-planning`
 * skill. Entities where BMad isn't installed, or where config couldn't be
 * resolved, contribute no fact row rather than a row full of zeros — the
 * dashboard should be able to tell "no sprint data because BMad isn't
 * adopted here" apart from "BMad is adopted but no sprint has started".
 *
 * @public
 */
export const bmadSprintStatusFactRetriever: FactRetriever = {
  id: 'bmadSprintStatusFactRetriever',
  version: '0.1.0',
  title: 'BMad-METHOD sprint status',
  description:
    'Story/epic status counts and open action items from an entity’s sprint-status.yaml',
  schema: {
    sprintStatusFound: {
      type: 'boolean',
      description: 'Whether sprint-status.yaml exists at the resolved implementation-artifacts path',
    },
    storiesDone: { type: 'integer', description: 'Story count with status done' },
    storiesInProgress: { type: 'integer', description: 'Story count with status in-progress' },
    storiesReadyForDev: { type: 'integer', description: 'Story count with status ready-for-dev' },
    storiesBacklog: { type: 'integer', description: 'Story count with status backlog' },
    openActionItemCount: { type: 'integer', description: 'Count of action items not marked done' },
    sprintStatusAgeInDays: {
      type: 'integer',
      description: 'Days since sprint-status.yaml was last updated by BMad',
    },
    sprintStatusParseError: {
      type: 'string',
      description: 'Set when sprint-status.yaml exists but could not be parsed',
    },
  },
  handler: async (ctx: FactRetrieverContext): Promise<TechInsightFact[]> => {
    const { discovery, auth, urlReader, entityFilter, logger } = ctx;
    const { token } = await auth.getPluginRequestToken({
      onBehalfOf: await auth.getOwnServiceCredentials(),
      targetPluginId: 'catalog',
    });
    const catalogClient = new CatalogClient({ discoveryApi: discovery });
    const { items: entities } = await catalogClient.getEntities(
      { filter: entityFilter },
      { token },
    );

    const facts: TechInsightFact[] = [];
    for (const entity of entities as Entity[]) {
      const repoUrl = getEntityRepoUrl(entity);
      if (!repoUrl) continue;

      try {
        const repo = new UrlReaderRepoFileAccess(urlReader, repoUrl);
        const adoption = await detectBmad(repo, repoUrl);
        if (!adoption.bmadInstalled || !adoption.resolvedConfig) continue;

        const status = await parseSprintStatus(
          repo,
          adoption.resolvedConfig.implementationArtifactsPath,
        );
        if (!status.found) continue;

        facts.push({
          entity: {
            namespace: entity.metadata.namespace ?? 'default',
            kind: entity.kind,
            name: entity.metadata.name,
          },
          facts: {
            sprintStatusFound: status.found,
            storiesDone: status.storyCountsByStatus.done,
            storiesInProgress: status.storyCountsByStatus['in-progress'],
            storiesReadyForDev: status.storyCountsByStatus['ready-for-dev'],
            storiesBacklog: status.storyCountsByStatus.backlog,
            openActionItemCount: status.openActionItems.length,
            ...(status.ageInDays !== undefined
              ? { sprintStatusAgeInDays: status.ageInDays }
              : {}),
            ...(status.parseError
              ? { sprintStatusParseError: status.parseError }
              : {}),
          },
        });
      } catch (err) {
        logger?.warn(
          `bmadSprintStatusFactRetriever: failed to read ${repoUrl} for ${entity.kind}:${entity.metadata.namespace}/${entity.metadata.name}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    return facts;
  },
};
