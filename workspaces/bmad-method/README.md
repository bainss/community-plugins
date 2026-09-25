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
- `plugins/bmad-method-backend-module-scaffolder` — a Scaffolder backend module registering
  three actions that drive BMad-METHOD's own creation skills headlessly, via the
  [Claude Agent SDK](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk):
  - `bmad:install` — runs BMad's real installer (`npx bmad-method install --yes ...`, its
    documented headless-CI form) in the task workspace, so `_bmad/` and the skill files exist.
  - `bmad:create-product-brief` — runs `bmad-product-brief` headlessly against a free-text idea,
    producing `brief.md`.
  - `bmad:create-prd` — runs `bmad-prd` headlessly against a brief, producing `prd.md`.

  `examples/templates/bmad-new-product.yaml` wires these into a template: idea in, brief and PRD
  drafted, published to a new repository. See "Creation wizard" below for what this does and
  does not do yet.

## Creation wizard: what "headless" actually means here

BMad's skills (`bmad-product-brief`, `bmad-prd`, ...) are written as long, conversational,
multi-turn coaching prompts — they spawn research subagents, shell out to BMad's own Python
scripts (`uv run .../memlog.py`, `resolve_config.py`, ...) and expect a human to push back on thin
answers. They are not deterministic functions. Each skill documents a separate "Headless Mode"
contract for exactly this situation: given a free-form input payload and no human to ask, the
skill infers what it can, records what it can't as `assumptions[]` / `open_questions[]`, and ends
with a JSON status block instead of a conversation.

`bmad:create-product-brief` and `bmad:create-prd` invoke that headless contract for real, via the
Claude Agent SDK's `query()` (`skills: [<name>]`, `cwd: ctx.workspacePath`,
`permissionMode: 'bypassPermissions'` since there's no human present to approve tool calls) —
this is genuinely running BMad's own skill files, subagents and Python scripts included, not a
reimplementation or a canned summary of what the skill would do. `parseHeadlessStatus` then reads
the skill's own end-of-run JSON block back out of the transcript.

What "review-gated" means in practice: Backstage Scaffolder tasks run a template's steps to
completion once started — there's no built-in way to pause a running task for a human to approve
one step's output before the next step runs. So the gate here is **after** the wizard finishes,
not in the middle of it: `bmad:create-prd`'s `openQuestions`/`assumptions` outputs surface in the
task's own log, the generated `brief.md`/`prd.md` carry BMad's own frontmatter `status` field, and
review happens by reading those (and the new repository's initial commit) before treating either
document as final — the same way a human reviewer would triage a headless run's
`open_questions[]` per BMad's own contract. It is not a UI review step inside the task.

Also not yet done:

- No live end-to-end run of this against a real Anthropic API key — verified by typechecking
  against the real `@anthropic-ai/claude-agent-sdk` / `@backstage/plugin-scaffolder-node` type
  definitions and by unit-testing `parseHeadlessStatus`/the actions against mocked SDK output, not
  by actually invoking Claude.
- The backend process running these actions needs its own Anthropic credentials (an
  `ANTHROPIC_API_KEY` in its environment, or an existing `claude login` on that machine) — this
  is a real runtime prerequisite the Agent SDK's subprocess reads directly from the environment,
  not something this workspace's own config schema knows about.
- `bmad:install`'s `npx bmad-method install` needs Node 20.12+ (already required by Backstage
  itself) and, per BMad's own prerequisites, `uv` for any skill that shells out through it —
  missing `uv` degrades some skills rather than failing the install outright.
- No `existing-repo` path or `catalog:register` step yet — the template always creates a new
  repository and stops there; per the workspace's roadmap (see the living plan doc), those are a
  later phase, once this phase's actions are confirmed working end to end.

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

For the creation wizard, install the Scaffolder module alongside Scaffolder itself and a
publisher module (`publish:github`, used by `examples/templates/bmad-new-product.yaml`):

```sh
yarn add --cwd packages/backend @backstage/plugin-scaffolder-backend
yarn add --cwd packages/backend @backstage/plugin-scaffolder-backend-module-github
yarn add --cwd packages/backend @backstage-community/plugin-bmad-method-backend-module-scaffolder
```

```ts
// packages/backend/src/index.ts
backend.add(import('@backstage/plugin-scaffolder-backend'));
backend.add(import('@backstage/plugin-scaffolder-backend-module-github'));
backend.add(
  import('@backstage-community/plugin-bmad-method-backend-module-scaffolder'),
);
```

Then register `examples/templates/bmad-new-product.yaml` (or your own copy of it) as a
`Template`-kind catalog location, and make sure the backend process has `ANTHROPIC_API_KEY` set —
see "Creation wizard" above for why.
