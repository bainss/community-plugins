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

import type { Config } from '@backstage/config';

/**
 * Reads the optional `bmadMethod.ai` config block (see `config.d.ts`) and
 * turns it into an environment-variable overlay for the Claude Code CLI
 * subprocess that `runBmadSkill` spawns via the Agent SDK.
 *
 * Returns `undefined` when the block isn't present at all, so the default
 * behavior — inherit whatever ANTHROPIC_* variables are already set on the
 * Backstage backend process's own environment — is completely unchanged
 * for a deployment that hasn't opted into this.
 *
 * Anthropic's Claude Code CLI (which the Agent SDK's subprocess actually
 * is) already knows how to route requests through Microsoft Foundry given
 * the right `ANTHROPIC_FOUNDRY_*` environment variables — this function
 * doesn't reimplement that routing, it only maps this workspace's own
 * config shape onto the variable names Claude Code itself reads. Bedrock
 * and Vertex follow the same env-var-driven pattern in Claude Code, but
 * aren't modeled here yet since nothing in this workspace has exercised
 * them.
 *
 * @throws Error if `bmadMethod.ai` is configured inconsistently (both
 * `anthropic` and `foundry` set, or `foundry` missing/duplicating its
 * `resource`/`baseUrl` pair) — this is a config mistake an operator should
 * fix, not something to silently paper over by guessing which provider was
 * meant.
 */
export function resolveAiEnv(
  config: Config,
): Record<string, string> | undefined {
  const aiConfig = config.getOptionalConfig('bmadMethod.ai');
  if (!aiConfig) {
    return undefined;
  }

  const anthropic = aiConfig.getOptionalConfig('anthropic');
  const foundry = aiConfig.getOptionalConfig('foundry');

  if (anthropic && foundry) {
    throw new Error(
      "Invalid config at 'bmadMethod.ai': 'anthropic' and 'foundry' are alternative providers for the same skill run — configure only one.",
    );
  }

  const overrides: Record<string, string> = {};

  const apiKey = anthropic?.getOptionalString('apiKey');
  if (apiKey) {
    overrides.ANTHROPIC_API_KEY = apiKey;
  }

  if (foundry) {
    const resource = foundry.getOptionalString('resource');
    const baseUrl = foundry.getOptionalString('baseUrl');
    if (resource && baseUrl) {
      throw new Error(
        "Invalid config at 'bmadMethod.ai.foundry': 'resource' and 'baseUrl' are mutually exclusive — set only one.",
      );
    }
    if (!resource && !baseUrl) {
      throw new Error(
        "Invalid config at 'bmadMethod.ai.foundry': one of 'resource' or 'baseUrl' is required.",
      );
    }
    if (resource) {
      overrides.ANTHROPIC_FOUNDRY_RESOURCE = resource;
    }
    if (baseUrl) {
      overrides.ANTHROPIC_FOUNDRY_BASE_URL = baseUrl;
    }

    const foundryApiKey = foundry.getOptionalString('apiKey');
    if (foundryApiKey) {
      overrides.ANTHROPIC_FOUNDRY_API_KEY = foundryApiKey;
    }
    const authToken = foundry.getOptionalString('authToken');
    if (authToken) {
      overrides.ANTHROPIC_FOUNDRY_AUTH_TOKEN = authToken;
    }
  }

  return Object.keys(overrides).length > 0 ? overrides : undefined;
}
