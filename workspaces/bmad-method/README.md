# bmad-method

Backstage integration for [BMad-METHOD](https://github.com/bmad-code-org/BMAD-METHOD), a
skills-based AI-driven delivery framework.

## Packages

- `plugins/bmad-method-common` — shared fact/type shapes used by the other packages here.
- `plugins/bmad-method-backend-module-tech-insights` — a Tech Insights backend module that
  registers two fact retrievers:
  - `bmadAdoptionFactRetriever` — whether an entity's repo has BMad-METHOD installed, and
    which modules it uses (from `_bmad/config.toml` and `module-manifest.toml` files).
  - `bmadSprintStatusFactRetriever` — story/epic status counts and open action items from
    `sprint-status.yaml`, as produced by BMad's `bmad-sprint-planning` skill.

## Status

Early spike. The fact-retriever logic (`src/lib/*`) has been unit tested against BMad-METHOD's
own real fixture files (config template, sprint-status template, module manifest — copied
verbatim from the upstream repo), and the whole package has been typechecked against the real
published `@backstage/*` and `@backstage-community/plugin-tech-insights-*` type definitions.

Not yet done, and needed before this is a real contribution:

- A `packages/app` + `packages/backend` example harness (the usual `yarn create-workspace` +
  `yarn new` output), since this workspace was hand-authored rather than generated — the
  generator couldn't be run from the environment this was built in (see note below).
- `yarn install` against this monorepo's actual `backstage:`-pinned dependency versions and a
  real `yarn test` / `yarn lint` pass — the verification described above used direct npm
  installs of the equivalent published packages in an isolated scratch directory, not this
  workspace's own lockfile.
- A frontend entity-content page / dashboard consuming these facts (see the plan doc).
- Deciding whether this should be its own workspace (as scaffolded here) or contributed as a
  new package inside `workspaces/tech-insights` instead, since it depends entirely on that
  plugin's extension points.
- Wiring `bmadAdoptionFactRetriever` / `bmadSprintStatusFactRetriever` into
  `packages/backend/src/index.ts` of a real Backstage instance for an end-to-end smoke test —
  everything here has been tested against fakes/mocks, not a running catalog + Tech Insights
  engine.

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
