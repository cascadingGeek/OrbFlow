# OrbFlow

Physics based bubble (orb) chart library on canvas, zero runtime dependencies. v1 ships vanilla JS + React only; Vue, Svelte, Angular arrive later as additive minor releases.

## Stack

- **Language / Runtime**: TypeScript 5 (`strict`), output ES2020 for browsers; build machine Node 22.18+ or 24.11+, consumers `engines.node >=18`
- **Framework**: none in core; React 18/19 as an optional peer for `orbflow/react`
- **Build**: tsdown, exact pinned (spec 0001), ESM + CJS with a shared core chunk, `.d.mts`/`.d.cts` types, minified IIFE (`window.OrbFlow`). Replaces Rollup (feature 3 in progress)
- **Package checks**: publint, `@arethetypeswrong/cli`, size-limit (core 8 kB, react 9 kB, cdn 8 kB gzip), `scripts/verify-dist.mjs`, smoke fixtures in `test/consumers/`
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
```
`prepublishOnly` runs lint, test, build, check:package, size, smoke in that order.

## Specs

Stored in `docs/specs/`. Format: `docs/specs/NNNN-title.md`. Scope lives in `docs/scope/scope.md`.

## Rules

- SOLID OOP: small single purpose classes (under ~200 lines), composed behind the thin public `OrbChart`; dependencies passed through constructors, no globals or registries; composition over inheritance. Tests inject fakes via constructors.
- Folders by role under `app/`: `core/`, `renderer/`, `types/`, `react/` (future frameworks become sibling folders on the same core).
- TypeScript `strict`: no `any` (use `unknown` and narrow), exhaustive types. Public types are part of the 1.0 promise.
- Named exports only, no default exports. Public surface is exactly what spec 0001 AC-3 lists; a new public export is an API decision, never incidental. Never export internals (`PhysicsEngine`, `CanvasRenderer`).
- No DOM at import time: touch `window`/`document` only inside constructors or methods (SSR safety).
- The React entry imports the core by relative path, never as `orbflow`. `"use client"` is added by the build, never written in source.
- Zero runtime `dependencies`; stay within the size budgets, or revisit them in spec 0001 on purpose.
- TSDoc on every exported class, method, prop, and type, including defaults.
- Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`).

## Tooling

Chosen in /audit, installed by `/develop tooling` (scope feature 2):
- Lint/format: ESLint 9 flat config + typescript-eslint + eslint-plugin-react-hooks, Prettier.
- Pre-commit: lint + format + typecheck on staged files via a git hook.
  (`simple-git-hooks` runs `lint-staged` then `npm run typecheck`; `npm install` installs the hook through `prepare`.)
- Testing: unit + integration with a framework (Jest installed; `/test` sets up the runner), plus spec 0001's dist checks and smoke fixtures.
- CI: GitHub Actions on push and PR running lint, typecheck, test, build, check:package.

## Git

- integration: on
- branch prefix: feat/
- commit: per-milestone

## Agent skills

- [tsdown-migrate](.claude/skills/tsdown-migrate/): `rolldown/tsdown`, tsdown config options, defaults, and migration rules (load for build config work)

Declined: antfu/skills tsdown, publint skill, size-limit skill

## Context files

<!-- Nested AGENTS.md files are listed here as they are created -->

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
