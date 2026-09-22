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
import { getEntityRepoUrl } from '../lib/getEntityRepoUrl';
import { UrlReaderRepoFileAccess } from '../lib/repoFileAccess';

/**
 * Reports whether a catalog entity's repo has BMad-METHOD installed, and
 * which modules it uses. Entities with no source-location annotation (no
 * repo checkout to look at) are skipped rather than reported as
 * "not installed" — that would conflate "doesn't apply" with "hasn't
 * adopted it yet", which the org-wide adoption dashboard needs to tell
 * apart.
 *
 * @public
 */
export const bmadAdoptionFactRetriever: FactRetriever = {
  id: 'bmadAdoptionFactRetriever',
  version: '0.1.0',
  title: 'BMad-METHOD adoption',
  description:
    'Detects BMad-METHOD installation and configuration for an entity’s repository',
  schema: {
    bmadInstalled: {
      type: 'boolean',
      description: 'Whether _bmad/config.toml exists in the repo',
    },
    bmadModules: {
      type: 'set',
      description: 'BMad module ids discovered from module-manifest.toml files',
    },
    bmadConfigParseError: {
      type: 'string',
      description:
        'Set when _bmad/config.toml exists but could not be parsed',
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

        facts.push({
          entity: {
            namespace: entity.metadata.namespace ?? 'default',
            kind: entity.kind,
            name: entity.metadata.name,
          },
          facts: {
            bmadInstalled: adoption.bmadInstalled,
            bmadModules: adoption.bmadModules,
            ...(adoption.configParseError
              ? { bmadConfigParseError: adoption.configParseError }
              : {}),
          },
        });
      } catch (err) {
        // One entity's repo being unreachable (deleted, private, rate
        // limited) shouldn't fail the whole scheduled run.
        logger?.warn(
          `bmadAdoptionFactRetriever: failed to read ${repoUrl} for ${entity.kind}:${entity.metadata.namespace}/${entity.metadata.name}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    return facts;
  },
};
