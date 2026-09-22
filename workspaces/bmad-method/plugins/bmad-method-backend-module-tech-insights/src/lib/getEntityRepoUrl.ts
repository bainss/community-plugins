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

import { ANNOTATION_SOURCE_LOCATION, Entity } from '@backstage/catalog-model';

/**
 * Reads the entity's source-location annotation and returns a URL usable
 * with `UrlReaderService.readTree`, or undefined if the entity doesn't
 * have one (e.g. it's not backed by a repo checkout at all).
 *
 * Follows the same annotation-reading convention used elsewhere in this
 * monorepo (see the linguist-backend plugin): the value is prefixed with
 * `url:` to distinguish it from other location types, which is stripped
 * before handing it to the URL reader.
 */
export function getEntityRepoUrl(entity: Entity): string | undefined {
  const raw = entity.metadata.annotations?.[ANNOTATION_SOURCE_LOCATION];
  if (!raw) return undefined;
  return raw.startsWith('url:') ? raw.slice(4) : raw;
}
