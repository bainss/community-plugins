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
import { createBmadProductBriefAction } from '../createBmadProductBriefAction';
// eslint-disable-next-line import/first
import { fakeActionContext } from '../testUtils';

describe('bmad:create-product-brief', () => {
  beforeEach(() => {
    runBmadSkillMock.mockReset();
  });

  it('parses a complete run and reports outputs', async () => {
    runBmadSkillMock.mockResolvedValue({
      resultText: JSON.stringify({
        status: 'complete',
        intent: 'create',
        brief: 'docs/brief.md',
        memlog: 'docs/.memlog.md',
      }),
      isError: false,
      totalCostUsd: 0.1,
      sessionId: 's1',
      numTurns: 5,
    });

    const action = createBmadProductBriefAction();
    const ctx = fakeActionContext({ productIdea: 'a marketplace for spare parts' });

    await action.handler(ctx);

    expect(runBmadSkillMock).toHaveBeenCalledWith(
      expect.objectContaining({
        skill: 'bmad-product-brief',
        cwd: '/tmp/fake-workspace',
        prompt: expect.stringContaining('a marketplace for spare parts'),
      }),
    );
    expect(ctx.outputs).toEqual({
      status: 'complete',
      briefPath: 'docs/brief.md',
      memlogPath: 'docs/.memlog.md',
    });
  });

  it('includes projectName and notes in the prompt when given', async () => {
    runBmadSkillMock.mockResolvedValue({
      resultText: JSON.stringify({ status: 'complete', intent: 'create' }),
      isError: false,
      totalCostUsd: 0,
      sessionId: 's1',
      numTurns: 1,
    });

    const action = createBmadProductBriefAction();
    const ctx = fakeActionContext({
      productIdea: 'idea text',
      projectName: 'spare-parts-hub',
      notes: 'B2B only for now',
    });

    await action.handler(ctx);

    const prompt = runBmadSkillMock.mock.calls[0][0].prompt as string;
    expect(prompt).toContain('project_name: spare-parts-hub');
    expect(prompt).toContain('B2B only for now');
  });

  it('throws when the skill reports blocked', async () => {
    runBmadSkillMock.mockResolvedValue({
      resultText: JSON.stringify({
        status: 'blocked',
        intent: 'create',
        reason: 'idea text was empty',
      }),
      isError: false,
      totalCostUsd: 0,
      sessionId: 's1',
      numTurns: 1,
    });

    const action = createBmadProductBriefAction();
    const ctx = fakeActionContext({ productIdea: '' });

    await expect(action.handler(ctx)).rejects.toThrow(/idea text was empty/);
  });

  it('throws when the run itself ended in error', async () => {
    runBmadSkillMock.mockResolvedValue({
      resultText: 'boom',
      isError: true,
      totalCostUsd: 0,
      sessionId: 's1',
      numTurns: 1,
    });

    const action = createBmadProductBriefAction();
    const ctx = fakeActionContext({ productIdea: 'idea' });

    await expect(action.handler(ctx)).rejects.toThrow(/ended in an error/);
  });

  it('throws when no headless status block can be parsed', async () => {
    runBmadSkillMock.mockResolvedValue({
      resultText: 'I drafted something but forgot the JSON footer.',
      isError: false,
      totalCostUsd: 0,
      sessionId: 's1',
      numTurns: 1,
    });

    const action = createBmadProductBriefAction();
    const ctx = fakeActionContext({ productIdea: 'idea' });

    await expect(action.handler(ctx)).rejects.toThrow(/did not end with a parseable/);
  });

  it('threads an env override through to runBmadSkill when the factory is given one', async () => {
    runBmadSkillMock.mockResolvedValue({
      resultText: JSON.stringify({ status: 'complete', intent: 'create' }),
      isError: false,
      totalCostUsd: 0,
      sessionId: 's1',
      numTurns: 1,
    });

    const action = createBmadProductBriefAction({
      env: { ANTHROPIC_FOUNDRY_RESOURCE: 'my-resource' },
    });
    const ctx = fakeActionContext({ productIdea: 'idea' });

    await action.handler(ctx);

    expect(runBmadSkillMock).toHaveBeenCalledWith(
      expect.objectContaining({
        env: { ANTHROPIC_FOUNDRY_RESOURCE: 'my-resource' },
      }),
    );
  });

  it('passes no env override to runBmadSkill when the factory is given none', async () => {
    runBmadSkillMock.mockResolvedValue({
      resultText: JSON.stringify({ status: 'complete', intent: 'create' }),
      isError: false,
      totalCostUsd: 0,
      sessionId: 's1',
      numTurns: 1,
    });

    const action = createBmadProductBriefAction();
    const ctx = fakeActionContext({ productIdea: 'idea' });

    await action.handler(ctx);

    expect(runBmadSkillMock.mock.calls[0][0].env).toBeUndefined();
  });
});
