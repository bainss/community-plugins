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

/**
 * A minimal dev-harness backend for this workspace, mirroring the pattern
 * used by `workspaces/tech-insights/packages/backend`: just enough plugins
 * (app, auth via guest provider, catalog, permissions, Tech Insights) to
 * run `yarn start` locally against a real catalog and exercise
 * `bmad-method-backend-module-tech-insights`'s two fact retrievers end to
 * end. Not a template for a production Backstage backend.
 */

import { createBackend } from '@backstage/backend-defaults';

const backend = createBackend();

backend.add(import('@backstage/plugin-app-backend'));
backend.add(import('@backstage/plugin-proxy-backend'));

// auth plugin — guest provider only, for local dev
backend.add(import('@backstage/plugin-auth-backend'));
backend.add(import('@backstage/plugin-auth-backend-module-guest-provider'));

// catalog plugin
backend.add(import('@backstage/plugin-catalog-backend'));

// permission plugin — allow-all, for local dev
backend.add(import('@backstage/plugin-permission-backend'));
backend.add(
  import('@backstage/plugin-permission-backend-module-allow-all-policy'),
);

// Tech Insights, plus this workspace's BMad-METHOD fact retrievers
backend.add(import('@backstage-community/plugin-tech-insights-backend'));
backend.add(
  import(
    '@backstage-community/plugin-bmad-method-backend-module-tech-insights'
  ),
);

// Scaffolder, plus this workspace's BMad-METHOD creation actions
backend.add(import('@backstage/plugin-scaffolder-backend'));
backend.add(import('@backstage/plugin-scaffolder-backend-module-github'));
backend.add(
  import('@backstage-community/plugin-bmad-method-backend-module-scaffolder'),
);

backend.start();
