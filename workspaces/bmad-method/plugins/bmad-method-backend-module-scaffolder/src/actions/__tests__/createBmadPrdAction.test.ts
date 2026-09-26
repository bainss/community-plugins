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

const runBmadSkillMock = jest.fn();

jest.mock('../../lib/runBmadSkill', () => ({
  runBmadSkill: (...args: unknown[]) => runBmadSkillMock(...args),
}));

// eslint-disable-next-line import/first
import { createBmadPrdAction } from '../createBmadPrdAction';
// eslint-disable-next-line import/first
import { fakeActionContext } from '../testUtils';

describe('bmad:create-prd', () => {
  beforeEach(() => {
    runBmadSkillMock.mockReset();
  });

  it('passes the brief path through to the prompt and reports outputs', async () => {
    runBmadSkillMock.mockResolvedValue({
      resultText: JSON.stringify({
        status: 'complete',
        intent: 'create',
        prd: 'docs/prd.md',
        open_questions: ['what is the pricing model?'],
      }),
      isError: false,
      totalCostUsd: 0.2,
      sessionId: 's2',
      numTurns: 8,
    });

    const action = createBmadPrdAction();
    const ctx = fakeActionContext({ briefPath: 'docs/brief.md' });

    await action.handler(ctx);

    const prompt = runBmadSkillMock.mock.calls[0][0].prompt as string;
    expect(prompt).toContain('brief: docs/brief.md');
    expect(ctx.outputs).toEqual({
      status: 'complete',
      prdPath: 'docs/prd.md',
      openQuestions: ['what is the pricing model?'],
    });
  });

  it('throws when the skill reports blocked', async () => {
    runBmadSkillMock.mockResolvedValue({
      resultText: JSON.stringify({
        status: 'blocked',
        intent: 'create',
        reason: 'brief.md could not be found',
      }),
      isError: false,
      totalCostUsd: 0,
      sessionId: 's2',
      numTurns: 1,
    });

    const action = createBmadPrdAction();
    const ctx = fakeActionContext({ briefPath: 'docs/missing.md' });

    await expect(action.handler(ctx)).rejects.toThrow(/brief.md could not be found/);
  });

  it('threads an env override through to runBmadSkill when the factory is given one', async () => {
    runBmadSkillMock.mockResolvedValue({
      resultText: JSON.stringify({ status: 'complete', intent: 'create' }),
      isError: false,
      totalCostUsd: 0,
      sessionId: 's2',
      numTurns: 1,
    });

    const action = createBmadPrdAction({
      env: { ANTHROPIC_API_KEY: 'sk-test' },
    });
    const ctx = fakeActionContext({ briefPath: 'docs/brief.md' });

    await action.handler(ctx);

    expect(runBmadSkillMock).toHaveBeenCalledWith(
      expect.objectContaining({ env: { ANTHROPIC_API_KEY: 'sk-test' } }),
    );
  });
});
