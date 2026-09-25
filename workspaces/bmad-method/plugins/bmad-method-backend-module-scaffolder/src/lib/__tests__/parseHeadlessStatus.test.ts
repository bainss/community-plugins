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

import { parseHeadlessStatus } from '../parseHeadlessStatus';

describe('parseHeadlessStatus', () => {
  it('parses a bare JSON result', () => {
    const text = JSON.stringify({
      status: 'complete',
      intent: 'create',
      brief: '/tmp/ws/docs/brief.md',
      open_questions: ['what is the target audience?'],
    });

    expect(parseHeadlessStatus(text)).toEqual({
      status: 'complete',
      intent: 'create',
      reason: undefined,
      assumptions: undefined,
      openQuestions: ['what is the target audience?'],
      brief: '/tmp/ws/docs/brief.md',
      prd: undefined,
      addendum: undefined,
      memlog: undefined,
      validationReport: undefined,
      offerToUpdate: undefined,
      changesSummary: undefined,
      conflictsWithPriorDecisions: undefined,
      externalHandoffs: undefined,
    });
  });

  it('parses JSON inside a fenced code block, preferring the last one', () => {
    const text = [
      'Here is an earlier unrelated snippet:',
      '```json',
      '{"foo": "bar"}',
      '```',
      '',
      "I've drafted the brief. Here's the status:",
      '```json',
      JSON.stringify({ status: 'partial', intent: 'create', prd: 'prd.md' }),
      '```',
    ].join('\n');

    const result = parseHeadlessStatus(text);
    expect(result?.status).toBe('partial');
    expect(result?.prd).toBe('prd.md');
  });

  it('falls back to the last balanced object when there is no fence', () => {
    const text = `The brief is ready. {"status": "complete", "intent": "create", "brief": "brief.md"}`;
    const result = parseHeadlessStatus(text);
    expect(result?.status).toBe('complete');
    expect(result?.brief).toBe('brief.md');
  });

  it('maps a blocked status with its reason', () => {
    const text = JSON.stringify({
      status: 'blocked',
      intent: 'create',
      reason: 'no idea text provided',
    });
    const result = parseHeadlessStatus(text);
    expect(result).toEqual(
      expect.objectContaining({ status: 'blocked', reason: 'no idea text provided' }),
    );
  });

  it('maps external_handoffs entries', () => {
    const text = JSON.stringify({
      status: 'complete',
      intent: 'create',
      external_handoffs: [
        { directive: 'Confluence upload', tool: 'corp:confluence_upload', url: 'https://x', status: 'ok' },
      ],
    });
    const result = parseHeadlessStatus(text);
    expect(result?.externalHandoffs).toEqual([
      { directive: 'Confluence upload', tool: 'corp:confluence_upload', url: 'https://x', status: 'ok' },
    ]);
  });

  it('returns undefined when there is no JSON at all', () => {
    expect(parseHeadlessStatus('I drafted the brief but forgot to report status.')).toBeUndefined();
  });

  it('returns undefined when the JSON is missing required fields', () => {
    expect(parseHeadlessStatus(JSON.stringify({ foo: 'bar' }))).toBeUndefined();
  });

  it('returns undefined when status/intent hold unexpected values', () => {
    expect(
      parseHeadlessStatus(JSON.stringify({ status: 'done', intent: 'create' })),
    ).toBeUndefined();
  });

  it('accepts an already-parsed object (e.g. structured output)', () => {
    const result = parseHeadlessStatus({ status: 'complete', intent: 'validate' });
    expect(result).toEqual(expect.objectContaining({ status: 'complete', intent: 'validate' }));
  });
});
