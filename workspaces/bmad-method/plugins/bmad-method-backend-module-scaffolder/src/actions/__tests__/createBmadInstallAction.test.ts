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

const executeShellCommandMock = jest.fn();

jest.mock('@backstage/plugin-scaffolder-node', () => {
  const actual = jest.requireActual('@backstage/plugin-scaffolder-node');
  return {
    ...actual,
    executeShellCommand: (...args: unknown[]) => executeShellCommandMock(...args),
  };
});

// eslint-disable-next-line import/first
import { createBmadInstallAction } from '../createBmadInstallAction';
// eslint-disable-next-line import/first
import { fakeActionContext } from '../testUtils';

describe('bmad:install', () => {
  beforeEach(() => {
    executeShellCommandMock.mockReset();
    executeShellCommandMock.mockResolvedValue(undefined);
  });

  it('runs the documented headless-CI install command with defaults', async () => {
    const action = createBmadInstallAction();
    // Omitting modules/tools simulates an actual invocation that leaves
    // these to their schema defaults; ctx.input's declared type says they
    // are always present (z.infer of a `.default()` schema), so an empty
    // object needs an explicit cast here — the point of the test is that
    // the action's own `= [...]` destructuring defaults hold up even if
    // nothing upstream filled these in.
    const ctx = fakeActionContext({} as Partial<Parameters<typeof action.handler>[0]['input']>);

    await action.handler(ctx);

    expect(executeShellCommandMock).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'npx',
        args: [
          '--yes',
          'bmad-method',
          'install',
          '--yes',
          '--modules',
          'bmm',
          '--tools',
          'claude-code',
        ],
        options: { cwd: '/tmp/fake-workspace' },
      }),
    );
  });

  it('honors custom modules, tools, and a package version', async () => {
    const action = createBmadInstallAction();
    const ctx = fakeActionContext({
      modules: ['bmm', 'gds'],
      tools: ['claude-code', 'cursor'],
      packageVersion: 'next',
    });

    await action.handler(ctx);

    expect(executeShellCommandMock).toHaveBeenCalledWith(
      expect.objectContaining({
        args: [
          '--yes',
          'bmad-method@next',
          'install',
          '--yes',
          '--modules',
          'bmm,gds',
          '--tools',
          'claude-code,cursor',
        ],
      }),
    );
  });
});
