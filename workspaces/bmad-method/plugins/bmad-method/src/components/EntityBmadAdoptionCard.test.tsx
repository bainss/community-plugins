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

import React from 'react';
import { render, screen } from '@testing-library/react';
import { EntityBmadAdoptionCard } from './EntityBmadAdoptionCard';

const mockEntity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name: 'example', namespace: 'default' },
  spec: { type: 'service' },
};

jest.mock('@backstage/plugin-catalog-react', () => ({
  useEntity: () => ({ entity: mockEntity }),
}));

const getFacts = jest.fn();
jest.mock('@backstage/frontend-plugin-api', () => ({
  useApi: () => ({ getFacts }),
}));
jest.mock('@backstage-community/plugin-tech-insights-react', () => ({
  techInsightsApiRef: 'tech-insights-api-ref',
}));

describe('EntityBmadAdoptionCard', () => {
  beforeEach(() => {
    getFacts.mockReset();
  });

  it('shows a not-adopted empty state when BMad is not installed', async () => {
    getFacts.mockResolvedValue({
      bmadAdoptionFactRetriever: {
        timestamp: '2026-09-22T00:00:00Z',
        version: '0.1.0',
        facts: { bmadInstalled: false, bmadModules: [] },
      },
    });

    render(<EntityBmadAdoptionCard />);

    expect(await screen.findByText('Not adopted')).toBeInTheDocument();
  });

  it('shows modules and sprint status when BMad is installed', async () => {
    getFacts.mockResolvedValue({
      bmadAdoptionFactRetriever: {
        timestamp: '2026-09-22T00:00:00Z',
        version: '0.1.0',
        facts: { bmadInstalled: true, bmadModules: ['method'] },
      },
      bmadSprintStatusFactRetriever: {
        timestamp: '2026-09-22T00:00:00Z',
        version: '0.1.0',
        facts: {
          sprintStatusFound: true,
          storiesDone: 1,
          storiesInProgress: 0,
          storiesReadyForDev: 1,
          storiesBacklog: 5,
          openActionItemCount: 1,
        },
      },
    });

    render(<EntityBmadAdoptionCard />);

    expect(await screen.findByText('Installed')).toBeInTheDocument();
    expect(screen.getByText('method')).toBeInTheDocument();
    expect(
      screen.getByText('1 done · 0 in progress · 1 ready · 5 backlog'),
    ).toBeInTheDocument();
    expect(screen.getByText('1 open action item')).toBeInTheDocument();
  });
});
