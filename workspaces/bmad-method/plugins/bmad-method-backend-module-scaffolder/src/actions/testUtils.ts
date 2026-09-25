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

import type { ActionContext } from '@backstage/plugin-scaffolder-node';
import type { JsonObject } from '@backstage/types';

/**
 * A minimal fake `ActionContext`, enough to exercise an action's handler in
 * a unit test without a real scaffolder task/broker behind it.
 */
export function fakeActionContext<
  TInput extends JsonObject,
  TOutput extends JsonObject = JsonObject,
>(
  input: Partial<TInput>,
): ActionContext<TInput, TOutput> & { outputs: Record<string, unknown> } {
  const outputs: Record<string, unknown> = {};
  const ctx = {
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      child: jest.fn(),
    },
    workspacePath: '/tmp/fake-workspace',
    input,
    checkpoint: jest.fn(async (opts: { fn: () => unknown }) => opts.fn()),
    output: jest.fn((name: string, value: unknown) => {
      outputs[name] = value;
    }),
    createTemporaryDirectory: jest.fn(async () => '/tmp/fake-workspace/tmp'),
    getInitiatorCredentials: jest.fn(),
    task: { id: 'task-1' },
    outputs,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return ctx;
}
