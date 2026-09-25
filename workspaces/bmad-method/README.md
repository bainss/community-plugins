# bmad-method

Backstage integration for [BMad-METHOD](https://github.com/bmad-code-org/BMAD-METHOD), a
skills-based AI-driven delivery framework.

## Packages

- `packages/backend` — a minimal dev-harness backend (app, guest auth, catalog, permissions,
  Tech Insights, and this workspace's own backend module), for running `yarn start` locally
  against a real catalog.
- `plugins/bmad-method-common` — shared fact/type shapes used by the other packages here.
- `plugins/bmad-method-backend-module-tech-insights` — a Tech Insights backend module that
  registers two fact retrievers:
  - `bmadAdoptionFactRetriever` — whether an entity's repo has BMad-METHOD installed, and
    which modules it uses (from `_bmad/config.toml` and `module-manifest.toml` files).
  - `bmadSprintStatusFactRetriever` — story/epic status counts and open action items from
    `sprint-status.yaml`, as produced by BMad's `bmad-sprint-planning` skill.
- `plugins/bmad-method` — frontend plugin. Registers an `EntityCardBlueprint` extension
  (`EntityBmadAdoptionCard`) that shows on any catalog entity's overview page: adoption status,
  installed modules, and — when available — sprint story/epic counts and open action items,
  read live from Tech Insights via `techInsightsApiRef.getFacts(...)`.

## Install

```sh
yarn add --cwd packages/backend @backstage-community/plugin-tech-insights-backend
yarn add --cwd packages/backend @backstage-community/plugin-bmad-method-backend-module-tech-insights
```

Then add the module to your backend, alongside Tech Insights itself:

```ts
// packages/backend/src/index.ts
backend.add(import('@backstage-community/plugin-tech-insights-backend'));
backend.add(
  import(
    '@backstage-community/plugin-bmad-method-backend-module-tech-insights'
  ),
);
```

No further config is required — the module registers its fact retrievers on init. Tech
Insights' own scheduling/persistence config governs how often they run.
