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
import useAsync from 'react-use/lib/useAsync';
import {
  EmptyState,
  InfoCard,
  Progress,
  ResponseErrorPanel,
  StatusError,
  StatusOK,
  StatusWarning,
} from '@backstage/core-components';
import { useApi } from '@backstage/frontend-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import { getCompoundEntityRef } from '@backstage/catalog-model';
import Chip from '@material-ui/core/Chip';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import { techInsightsApiRef } from '@backstage-community/plugin-tech-insights-react';

const BMAD_ADOPTION_FACT_ID = 'bmadAdoptionFactRetriever';
const BMAD_SPRINT_STATUS_FACT_ID = 'bmadSprintStatusFactRetriever';

/**
 * Entity card showing whether BMad-METHOD is installed for this entity's
 * repo, which modules it uses, and — when available — current sprint
 * status, drawn from the two fact retrievers this workspace registers
 * with Tech Insights.
 *
 * @public
 */
export function EntityBmadAdoptionCard() {
  const { entity } = useEntity();
  const techInsightsApi = useApi(techInsightsApiRef);

  const { value, loading, error } = useAsync(async () => {
    return techInsightsApi.getFacts(getCompoundEntityRef(entity), [
      BMAD_ADOPTION_FACT_ID,
      BMAD_SPRINT_STATUS_FACT_ID,
    ]);
  }, [entity]);

  if (loading) {
    return (
      <InfoCard title="BMad-METHOD">
        <Progress />
      </InfoCard>
    );
  }

  if (error) {
    return (
      <InfoCard title="BMad-METHOD">
        <ResponseErrorPanel error={error} />
      </InfoCard>
    );
  }

  const adoption = value?.[BMAD_ADOPTION_FACT_ID]?.facts;
  const sprintStatus = value?.[BMAD_SPRINT_STATUS_FACT_ID]?.facts;

  if (!adoption || adoption.bmadInstalled !== true) {
    return (
      <InfoCard title="BMad-METHOD">
        <EmptyState
          missing="data"
          title="Not adopted"
          description="No _bmad/config.toml was found in this entity's repository."
        />
      </InfoCard>
    );
  }

  const modules = Array.isArray(adoption.bmadModules)
    ? (adoption.bmadModules as string[])
    : [];
  const configParseError =
    typeof adoption.bmadConfigParseError === 'string'
      ? adoption.bmadConfigParseError
      : undefined;

  return (
    <InfoCard title="BMad-METHOD">
      <Grid container spacing={2} direction="column">
        <Grid item>
          <StatusOK>Installed</StatusOK>
          {configParseError && (
            <Typography variant="caption" color="error" component="div">
              Config parse error: {configParseError}
            </Typography>
          )}
        </Grid>
        {modules.length > 0 && (
          <Grid item>
            <Typography variant="subtitle2">Modules</Typography>
            {modules.map(module => (
              <Chip key={module} label={module} size="small" />
            ))}
          </Grid>
        )}
        {sprintStatus?.sprintStatusFound === true && (
          <Grid item>
            <Typography variant="subtitle2">Sprint status</Typography>
            <Typography variant="body2">
              {String(sprintStatus.storiesDone ?? 0)} done ·{' '}
              {String(sprintStatus.storiesInProgress ?? 0)} in progress ·{' '}
              {String(sprintStatus.storiesReadyForDev ?? 0)} ready ·{' '}
              {String(sprintStatus.storiesBacklog ?? 0)} backlog
            </Typography>
            {Number(sprintStatus.openActionItemCount ?? 0) > 0 && (
              <Typography
                variant="body2"
                component="div"
                style={{ marginTop: 4 }}
              >
                <StatusWarning>
                  {String(sprintStatus.openActionItemCount)} open action item
                  {Number(sprintStatus.openActionItemCount) === 1 ? '' : 's'}
                </StatusWarning>
              </Typography>
            )}
            {typeof sprintStatus.sprintStatusParseError === 'string' && (
              <Typography variant="body2" component="div">
                <StatusError>
                  Could not parse sprint-status.yaml:{' '}
                  {sprintStatus.sprintStatusParseError}
                </StatusError>
              </Typography>
            )}
          </Grid>
        )}
      </Grid>
    </InfoCard>
  );
}
