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

export interface Config {
  bmadMethod?: {
    /**
     * Which AI provider the bmad:create-* actions use to run BMad's skills
     * headlessly, via the Claude Agent SDK. Entirely optional: when this
     * whole block is left out, the actions fall back to whatever
     * ANTHROPIC_* variables are already set on the Backstage backend
     * process's own environment (a plain `ANTHROPIC_API_KEY`, or an
     * existing `claude login` on that machine) — this config block exists
     * so that choice can instead live in app-config.yaml alongside the
     * rest of a deployment's configuration, and so a non-default provider
     * (right now, Microsoft Foundry) can be selected without touching the
     * backend process's raw environment at all.
     *
     * `anthropic` and `foundry` are alternative providers for the same
     * skill run — set at most one.
     */
    ai?: {
      /** Route skill runs through the direct Anthropic API. */
      anthropic?: {
        /**
         * @visibility secret
         */
        apiKey?: string;
      };
      /**
       * Route skill runs through Anthropic's Claude models hosted on
       * Microsoft Foundry (Azure), instead of the direct Anthropic API.
       * Set exactly one of `resource` or `baseUrl`, and one of `apiKey` or
       * `authToken`.
       */
      foundry?: {
        /**
         * Foundry resource name, e.g. `my-resource`. Mutually exclusive
         * with `baseUrl`.
         */
        resource?: string;
        /**
         * Full Foundry resource base URL, e.g.
         * `https://my-resource.services.ai.azure.com/anthropic`. Mutually
         * exclusive with `resource`.
         */
        baseUrl?: string;
        /**
         * @visibility secret
         */
        apiKey?: string;
        /**
         * A Microsoft Entra ID bearer token. Takes precedence over
         * `apiKey` and Azure's default credential chain when both are set.
         * @visibility secret
         */
        authToken?: string;
      };
    };
  };
}
