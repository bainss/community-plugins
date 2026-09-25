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

import React from 'react';
import { createFrontendPlugin } from '@backstage/frontend-plugin-api';
import { EntityCardBlueprint } from '@backstage/plugin-catalog-react/alpha';

/**
 * An entity-page card showing BMad-METHOD adoption and sprint status,
 * sourced from the `bmad-method-backend-module-tech-insights` fact
 * retrievers via Tech Insights.
 *
 * @alpha
 */
const entityBmadAdoptionCard = EntityCardBlueprint.make({
  name: 'adoption',
  params: {
    type: 'info',
    loader: () =>
      import('./components/EntityBmadAdoptionCard').then(m => (
        <m.EntityBmadAdoptionCard />
      )),
  },
});

/**
 * The BMad-METHOD Backstage frontend plugin.
 *
 * @alpha
 */
export const bmadMethodPlugin = createFrontendPlugin({
  pluginId: 'bmad-method',
  extensions: [entityBmadAdoptionCard],
});
