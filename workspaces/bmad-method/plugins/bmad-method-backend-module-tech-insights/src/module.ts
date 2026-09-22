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

import { createBackendModule } from '@backstage/backend-plugin-api';
import { techInsightsFactRetrieversExtensionPoint } from '@backstage-community/plugin-tech-insights-node';
import { bmadAdoptionFactRetriever } from './factRetrievers/bmadAdoptionFactRetriever';
import { bmadSprintStatusFactRetriever } from './factRetrievers/bmadSprintStatusFactRetriever';

/**
 * Registers the BMad-METHOD fact retrievers with Tech Insights. Install
 * this backend module alongside `@backstage-community/plugin-tech-insights-backend`
 * in your Backstage backend — no further wiring is needed beyond that, and
 * beyond configuring Tech Insights' own persistence and cadence as usual.
 *
 * @public
 */
export const bmadMethodModuleTechInsights = createBackendModule({
  pluginId: 'tech-insights',
  moduleId: 'bmad-method',
  register(env) {
    env.registerInit({
      deps: {
        factRetrievers: techInsightsFactRetrieversExtensionPoint,
      },
      async init({ factRetrievers }) {
        factRetrievers.addFactRetrievers({
          [bmadAdoptionFactRetriever.id]: bmadAdoptionFactRetriever,
          [bmadSprintStatusFactRetriever.id]: bmadSprintStatusFactRetriever,
        });
      },
    });
  },
});
