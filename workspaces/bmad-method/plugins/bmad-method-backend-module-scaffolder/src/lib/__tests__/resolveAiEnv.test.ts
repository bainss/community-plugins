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

import { ConfigReader } from '@backstage/config';
import { resolveAiEnv } from '../resolveAiEnv';

describe('resolveAiEnv', () => {
  it('returns undefined when bmadMethod.ai is not configured at all', () => {
    expect(resolveAiEnv(new ConfigReader({}))).toBeUndefined();
  });

  it('returns undefined when bmadMethod.ai is present but empty', () => {
    expect(
      resolveAiEnv(new ConfigReader({ bmadMethod: { ai: {} } })),
    ).toBeUndefined();
  });

  it('maps a direct Anthropic API key', () => {
    const config = new ConfigReader({
      bmadMethod: { ai: { anthropic: { apiKey: 'sk-abc' } } },
    });
    expect(resolveAiEnv(config)).toEqual({ ANTHROPIC_API_KEY: 'sk-abc' });
  });

  it('maps a Foundry resource + API key', () => {
    const config = new ConfigReader({
      bmadMethod: {
        ai: { foundry: { resource: 'my-resource', apiKey: 'fk-abc' } },
      },
    });
    expect(resolveAiEnv(config)).toEqual({
      ANTHROPIC_FOUNDRY_RESOURCE: 'my-resource',
      ANTHROPIC_FOUNDRY_API_KEY: 'fk-abc',
    });
  });

  it('maps a Foundry baseUrl + Entra ID auth token', () => {
    const config = new ConfigReader({
      bmadMethod: {
        ai: {
          foundry: {
            baseUrl: 'https://my-resource.services.ai.azure.com/anthropic',
            authToken: 'entra-token',
          },
        },
      },
    });
    expect(resolveAiEnv(config)).toEqual({
      ANTHROPIC_FOUNDRY_BASE_URL:
        'https://my-resource.services.ai.azure.com/anthropic',
      ANTHROPIC_FOUNDRY_AUTH_TOKEN: 'entra-token',
    });
  });

  it('rejects a Foundry block with both resource and baseUrl', () => {
    const config = new ConfigReader({
      bmadMethod: {
        ai: { foundry: { resource: 'x', baseUrl: 'https://x' } },
      },
    });
    expect(() => resolveAiEnv(config)).toThrow(/mutually exclusive/);
  });

  it('rejects a Foundry block with neither resource nor baseUrl', () => {
    const config = new ConfigReader({
      bmadMethod: { ai: { foundry: { apiKey: 'x' } } },
    });
    expect(() => resolveAiEnv(config)).toThrow(
      /one of 'resource' or 'baseUrl' is required/,
    );
  });

  it('rejects configuring both anthropic and foundry', () => {
    const config = new ConfigReader({
      bmadMethod: {
        ai: {
          anthropic: { apiKey: 'x' },
          foundry: { resource: 'y' },
        },
      },
    });
    expect(() => resolveAiEnv(config)).toThrow(/alternative providers/);
  });
});
