# OrbFlow

Physics based bubble (orb) chart library on canvas, zero runtime dependencies. v1 ships vanilla JS + React only; Vue, Svelte, Angular arrive later as additive minor releases.

## Stack

- **Language / Runtime**: TypeScript 5 (`strict`), output ES2020 for browsers; build machine Node 22.18+ or 24.11+, consumers `engines.node >=18`
- **Framework**: none in core; React 18/19 as an optional peer for `orbflow/react`
- **Build**: tsdown, exact pinned (spec 0001), ESM + CJS with a shared core chunk, `.d.mts`/`.d.cts` types, minified IIFE (`window.OrbFlow`). Config in `tsdown.config.ts` (replaced Rollup in feature 3)
- **Package checks**: publint, `@arethetypeswrong/cli`, size-limit (core 9 kB, react 10 kB, cdn 9 kB gzip), `scripts/verify-dist.mjs`, smoke fixtures in `test/consumers/`
- **Package manager**: npm

## Build approach

Tracer Bullet: each feature goes end to end through core, React wrapper, types, tests, and docs, so the package stays shippable after every slice.

## Commands

```bash
npm install            # install
npm run dev            # watch build
npm run build          # build dist/
npm test               # source tests (Jest), never reads dist/
npm run lint           # ESLint
npm run typecheck      # tsc --noEmit
npm run format         # Prettier write (format:check to verify only)
npm run check:package  # publint + attw + dist verifier (after build)
npm run size           # size budgets (after build)
npm run smoke          # pack tarball, install into consumer fixtures
ORBFLOW_REACT_MAJOR=19 npm run smoke  # same, with React 19 and @types/react 19
```
`prepublishOnly` runs lint, typecheck, test, build, check:package, size, smoke in that order.

## Specs

Stored in `docs/specs/`. Format: `docs/specs/NNNN-title.md`, or a folder `docs/specs/NNNN-title/` holding `index.md` (build spec), `rationale.md`, and `verify.md` (verify steps). Scope lives in `docs/scope/scope.md`.

## Rules

- SOLID OOP: small single purpose classes (under ~200 lines), composed behind the thin public `OrbChart`; dependencies passed through constructors, no globals or registries; composition over inheritance. Tests inject fakes via constructors.
- Folders by role under `app/`: `core/`, `renderer/`, `types/`, `react/` (future frameworks become sibling folders on the same core).
- TypeScript `strict`: no `any` (use `unknown` and narrow), exhaustive types. Public types are part of the 1.0 promise.
- Named exports only, no default exports. Public surface is exactly what spec 0001 AC-3 lists; a new public export is an API decision, never incidental. Never export internals (`PhysicsEngine`, `CanvasRenderer`).
- Lifecycle: `OrbChart` registers every resource (canvas, input listeners, `ResizeObserver`) on its teardown list the moment it is created, and `destroy()` is idempotent. Time comes from the `AnimationLoop` clock, never `Date.now()`; collaborators take it as an argument so tests can fake it.
- No DOM at import time: touch `window`/`document` only inside constructors or methods (SSR safety).
- Pause means pause: `Playback` owns the user paused flag, and `setData`, resize, and `updateConfig` redraw a paused chart once but never queue a frame. The React component never touches the core during render, and passes callbacks through stable wrappers so a new function identity never causes an update.
- The React entry imports the core by relative path, never as `orbflow`. `"use client"` is added by the build, never written in source.
- Accessibility: the canvas and tooltip are `aria-hidden`; the hidden list of real buttons (`AccessibleLayer`) is the one source of truth for assistive technology, and orb text is always set with `textContent`. `ChartView` builds every visible part (canvas, tooltip, input, list, focus cue, resize observer) and removes its own parts if one fails to build.
- Reduced motion: `Playback.idle` is true when the developer paused or the chart is still (`reducedMotion` plus the system setting, via `MotionPreference`). A still chart queues no animation frame, so every visible change is one explicit draw through `Redrawer`, which settles the orbs first. A developer `pause()` beats still mode, and a paused still chart never moves.
- Zero runtime `dependencies`; stay within the size budgets (raised once on purpose, see spec 0001 *Revision*), or revisit them in spec 0001 again on purpose.
- TSDoc on every exported class, method, prop, and type, including defaults.
- Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`).

## Tooling

Chosen in /audit, installed by `/develop tooling` (scope feature 2):
- Lint/format: ESLint 9 flat config + typescript-eslint + eslint-plugin-react-hooks, Prettier.
- Pre-commit: lint + format + typecheck on staged files via a git hook.
  (`simple-git-hooks` runs `lint-staged` then `npm run typecheck`; `npm install` installs the hook through `prepare`.)
- Testing: unit + integration with a framework (Jest installed; `/test` sets up the runner), plus spec 0001's dist checks and smoke fixtures.
  (Jest + ts-jest, tests beside the source as `*.test.ts(x)`, choices in `test-preferences.json`. DOM tests opt in with a `@jest-environment jsdom` docblock and use the fakes in `app/test-support/fakeDom.ts` (2D canvas, ResizeObserver, animation frames, matchMedia, live listener counts, touch taps, key presses). A known, unfixed bug is kept as an `it.failing` test with a comment until it is fixed.)
- CI: GitHub Actions on push and PR running lint, typecheck, test, build, check:package, plus a `react-19` job (typecheck, React tests, build, smoke against React 19).

## Git

- integration: on
- branch prefix: feat/
- commit: per-milestone

## Agent skills

- [tsdown-migrate](.claude/skills/tsdown-migrate/): `rolldown/tsdown`, tsdown config options, defaults, and migration rules (load for build config work)

Declined: antfu/skills tsdown, publint skill, size-limit skill

## Context files

<!-- Nested AGENTS.md files are listed here as they are created -->
- [test/consumers/AGENTS.md](test/consumers/AGENTS.md): smoke fixtures that install the packed tarball (how to add one)

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
