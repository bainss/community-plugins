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

const queryMock = jest.fn();

jest.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: (...args: unknown[]) => queryMock(...args),
}));

// eslint-disable-next-line import/first
import { BmadSkillRunError, runBmadSkill } from '../runBmadSkill';

function fakeQueryReturning(messages: unknown[]) {
  return {
    [Symbol.asyncIterator]: async function* () {
      for (const message of messages) {
        yield message;
      }
    },
  };
}

describe('runBmadSkill', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it('resolves with the success result once the run completes', async () => {
    queryMock.mockReturnValue(
      fakeQueryReturning([
        { type: 'system', subtype: 'init' },
        { type: 'assistant' },
        {
          type: 'result',
          subtype: 'success',
          is_error: false,
          result: '{"status":"complete","intent":"create"}',
          total_cost_usd: 0.05,
          session_id: 'sess-1',
          num_turns: 3,
        },
      ]),
    );

    const result = await runBmadSkill({
      skill: 'bmad-product-brief',
      cwd: '/tmp/ws',
      prompt: 'headless: true\nintent: create\nidea: a thing',
    });

    expect(result).toEqual({
      resultText: '{"status":"complete","intent":"create"}',
      isError: false,
      totalCostUsd: 0.05,
      sessionId: 'sess-1',
      numTurns: 3,
    });

    expect(queryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'headless: true\nintent: create\nidea: a thing',
        options: expect.objectContaining({
          cwd: '/tmp/ws',
          skills: ['bmad-product-brief'],
          permissionMode: 'bypassPermissions',
        }),
      }),
    );
  });

  it('surfaces is_error on an otherwise-successful result', async () => {
    queryMock.mockReturnValue(
      fakeQueryReturning([
        {
          type: 'result',
          subtype: 'success',
          is_error: true,
          result: 'the API returned an error mid-turn',
          total_cost_usd: 0.01,
          session_id: 'sess-2',
          num_turns: 1,
        },
      ]),
    );

    const result = await runBmadSkill({
      skill: 'bmad-prd',
      cwd: '/tmp/ws',
      prompt: 'headless: true',
    });

    expect(result.isError).toBe(true);
    expect(result.resultText).toContain('API returned an error');
  });

  it('throws BmadSkillRunError when the run ends in an error-subtype result', async () => {
    queryMock.mockReturnValue(
      fakeQueryReturning([
        {
          type: 'result',
          subtype: 'error_max_turns',
          is_error: true,
          errors: ['hit max turns'],
          total_cost_usd: 0.2,
          session_id: 'sess-3',
          num_turns: 50,
        },
      ]),
    );

    await expect(
      runBmadSkill({ skill: 'bmad-prd', cwd: '/tmp/ws', prompt: 'headless: true' }),
    ).rejects.toThrow(BmadSkillRunError);
  });

  it('throws BmadSkillRunError when no result message is ever produced', async () => {
    queryMock.mockReturnValue(fakeQueryReturning([{ type: 'system', subtype: 'init' }]));

    await expect(
      runBmadSkill({ skill: 'bmad-prd', cwd: '/tmp/ws', prompt: 'headless: true' }),
    ).rejects.toThrow(/ended without a result message/);
  });
});
