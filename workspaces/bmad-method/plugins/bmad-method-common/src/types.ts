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

/**
 * Shared fact shapes for the BMad-METHOD Backstage integration.
 *
 * These are what the tech-insights fact retriever module writes and the
 * dashboard/entity-tab frontend (a later package in this workspace) reads.
 * Kept deliberately small and defensively-optional: BMad's on-disk formats
 * are an implementation detail of its skills, not a published contract, so
 * every field here should degrade to "unknown" rather than throw when a
 * BMad release reshapes something.
 *
 * @public
 */

/** Resolved location of BMad's config, after merging team/user overrides. */
export interface BmadResolvedConfig {
  /** e.g. "my-project", from [core] project_name */
  projectName?: string;
  /** e.g. "/repo/_bmad-output/planning-artifacts", from [modules.bmm] planning_artifacts, overrides applied */
  planningArtifactsPath: string;
  /** e.g. "/repo/_bmad-output/implementation-artifacts", from [modules.bmm] implementation_artifacts, overrides applied */
  implementationArtifactsPath: string;
  /** e.g. "/repo/docs", from [modules.bmm] project_knowledge. Not a BMad output signal on its own. */
  projectKnowledgePath?: string;
}

/** Whether and how a repo has adopted BMad-METHOD. */
export interface BmadAdoptionFacts {
  bmadInstalled: boolean;
  /** `module` values collected across every discovered module-manifest.toml. Empty if not installed. */
  bmadModules: string[];
  /** Resolved config paths, when _bmad/config.toml could be read and parsed. */
  resolvedConfig?: BmadResolvedConfig;
  /** Set when config.toml exists but couldn't be parsed/resolved — "installed, details unknown". */
  configParseError?: string;
}

export type BmadStoryStatus =
  | 'backlog'
  | 'ready-for-dev'
  | 'in-progress'
  | 'review'
  | 'done'
  | 'unknown';

export type BmadEpicStatus = 'backlog' | 'in-progress' | 'done' | 'unknown';

export interface BmadActionItem {
  epic?: string | number;
  action: string;
  owner?: string;
  status: 'open' | 'in-progress' | 'done' | 'unknown';
}

/**
 * Parsed facts from sprint-status.yaml. All counts default to 0, not
 * undefined, so the dashboard never has to null-check.
 */
export interface BmadSprintStatusFacts {
  /** False when the file is missing entirely — a distinct state from "present but unparseable". */
  found: boolean;
  /** Set when the file exists but couldn't be parsed as the expected shape. */
  parseError?: string;
  projectName?: string;
  lastUpdated?: string;
  storyCountsByStatus: Record<BmadStoryStatus, number>;
  epicCountsByStatus: Record<BmadEpicStatus, number>;
  openActionItems: BmadActionItem[];
  /** Days since lastUpdated, when it could be parsed. Staleness thresholds are a UI/checks concern, not this shape's. */
  ageInDays?: number;
}
