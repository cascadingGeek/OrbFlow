# 0001. Package build and exports for orbflow v1

**Date**: 2026-10-11
**Status**: In Progress

## Summary

This spec decides how orbflow is built and published so `npm install orbflow` just works in vanilla projects, React apps, server rendered React (Next.js), TypeScript, and a plain `<script>` tag. The build moves from Rollup to tsdown (a fast, low config library bundler). It ships ESM and CommonJS (the two JavaScript module systems), a minified CDN file, and exact types for each. The React entry reuses the core instead of carrying its own copy. Automatic checks (publint, are-the-types-wrong, size-limit, and small consumer test projects) block any publish that would install broken.

## Context

orbflow is a zero dependency canvas bubble chart library. v1.0.0 targets vanilla JavaScript and React 18+ only, and its goal is adoption: a developer should install it and see a chart in minutes, in whatever setup they already have. The most common reason a new library gets abandoned on day one is not missing features. It's an install that fails to resolve, types that show red squiggles, or a crash in a server rendered React app.

The current build (Rollup, `rollup.config.mjs`) has real problems. The React bundle compiles a second full copy of the core (`PhysicsEngine` appears inside `dist/react.esm.js`), so React users who also import from `orbflow` ship the core twice, and the two `OrbChart` classes are not the same class. `dist/index.d.ts` is not a bundled type file; it points at relative paths. The `exports` map lists `import`/`require` before `types` and still advertises Vue, Svelte, and Angular entries that point at `.d.ts` files. The core entry exports `PhysicsEngine` (and both a named and a default `OrbChart`), which would freeze internals into the 1.0 stability promise. There is no size budget, no package shape check, and nothing proves the published tarball works in a consumer project.

Forces: the package must be safe under server rendering (no `window` or `document` at import time, and a `"use client"` marker for React Server Components). It must keep the "lightweight" claim honest as later features (lifecycle, accessibility, touch) add code. The team is one developer, so the build must be small to own and must fail loudly instead of silently shipping a broken package. Anything exported in 1.0 must stay stable until 2.0, while Vue, Svelte, and Angular arrive later as additive minor releases (1.1, 1.2, 1.3).

Prerequisite: scope feature 1 (trim to vanilla and React) removes the Vue, Svelte, and Angular sources and package fields. This spec assumes it has landed, or lands as the first step of this build.

## Requirements

**User stories**:
- As a developer using a bundler, I want `import { OrbChart } from 'orbflow'` to work with correct types, so I can try the library without configuring anything.
- As a React developer on Next.js App Router, I want to drop `<OrbChart>` from `orbflow/react` into a page without a wrapper file or a server error.
- As a vanilla developer without a bundler, I want to load orbflow from a CDN with one `<script>` tag.
- As the maintainer, I want the build to refuse to publish a package that is broken, mistyped, or over its size budget.

**Acceptance criteria**:
- **AC-1**: `orbflow` and `orbflow/react` resolve through the `exports` map in Node ESM (`import`), Node CommonJS (`require`), and bundlers. Both formats expose the same named exports.
- **AC-2**: TypeScript resolves correct types for both entries under `moduleResolution` `node10`, `node16`/`nodenext` (from both ESM and CommonJS files), and `bundler`. `attw --pack` reports no problems and `publint` reports no errors or warnings.
- **AC-3**: The core entry exports exactly `OrbChart` (named, no default export) plus the types `Orb`, `OrbChartConfig`, `OrbDataInput`, `PhysicsConfig`. The React entry exports `OrbChart` (the component), the type `OrbChartProps`, and re-exports the same four data types. `PhysicsEngine` and `CanvasRenderer` are not reachable from any public entry.
- **AC-4**: The core implementation exists exactly once per format in `dist/`: both entries import it from a shared chunk. The React entry file's first statement is `"use client"`; the core entry and shared chunks carry no such directive.
- **AC-5**: Importing either entry in Node with no DOM (no `window`, no `document`) does not throw.
- **AC-6**: `dist/orbflow.iife.js` is a minified file that, evaluated as a classic script, exposes `window.OrbFlow.OrbChart` (and no `default`). The `unpkg` and `jsdelivr` package fields point at it. A plain HTML page using it renders a chart (checked by hand in `/check verify`).
- **AC-7**: Enforced budgets (minified, gzip): the core entry ≤ 8 kB; the React entry ≤ the core budget + 1 kB (React itself excluded); the IIFE file ≤ 8 kB. Exceeding any budget fails `npm run size`.
- **AC-8**: React is an optional peer dependency (`^18.0.0 || ^19.0.0`). The package has zero runtime `dependencies`. Installing the tarball into a project without React prints no peer warning and no `ERESOLVE` error.
- **AC-9**: All JavaScript output targets ES2020, and every published `.mjs`, `.cjs`, and `.js` file ships a sourcemap with the original sources embedded.
- **AC-10**: `npm run smoke` packs the real tarball and installs it into three fixture projects (ESM, CommonJS, TypeScript). Each one imports both entries and passes, and any failure exits non zero.
- **AC-11**: `prepublishOnly` runs lint, source tests, build, package checks (publint, attw, and the `dist/` verifier), size, and smoke in that order, and any failure blocks `npm publish`. `package.json` declares `"sideEffects": false`.

## Options considered

### Option 1: Keep Rollup and rewrite the config

Fix the existing Rollup setup: one multi input build for ESM and CommonJS with a shared chunk, `rollup-plugin-dts` per entry and format, a separate IIFE config, and a per chunk banner for `"use client"`.

**Pros**:
- Already installed and extremely mature; every output need here is a known Rollup recipe.
- Full control over chunk naming, banners, and plugins.

**Cons**:
- Four or more config blocks plus several plugins (TypeScript, dts, resolve, commonjs, terser) to keep in sync; the current broken config shows how easy that is to get wrong.
- Producing separate `.d.mts` and `.d.cts` type files needs extra manual wiring.

### Option 2: tsdown

A library bundler built on Rolldown (a Rust port of Rollup's design). One config file emits ESM, CommonJS, and IIFE builds, bundled `.d.mts`/`.d.cts` types, and sourcemaps, with code splitting between entries.

**Pros**:
- Far less config to own; dual format types and fixed extensions are built in.
- Very fast builds, which keeps the check pipeline (build, attw, size, smoke) quick.
- Rolldown keeps Rollup's plugin and output option model, so per chunk banners and naming are still available.

**Cons**:
- Younger and still moving quickly (pre 1.0 at the time of writing), so minor upgrades can change behavior.
- Fewer answered questions online when something odd happens.

### Option 3: tsup

The esbuild based library bundler many packages use today.

**Pros**:
- Simple, widely used, lots of examples.

**Cons**:
- Its maintainers now direct new users to other tools, so it's a weak foundation for a package meant to last years.
- Code splitting for CommonJS is limited, which works against the shared chunk requirement (AC-4).

## Decision

**Chosen option**: Option 2: tsdown

Build orbflow with tsdown from a single `tsdown.config.ts`, emitting ESM + CommonJS with a shared core chunk and per format bundled types, plus a separate minified IIFE build, guarded by publint, are-the-types-wrong, a `dist/` verifier, size-limit, and packed tarball smoke tests.

**Implementation skills**: `tsdown-migrate` (`rolldown/tsdown`, `.claude/skills/tsdown-migrate/`). It's written for tsup to tsdown, but its option defaults (for example `clean` on by default, IIFE naming as `[name].iife.js`) and its Node runtime requirement apply here.

## Rationale

The real risk for a v1 launch is an install that silently breaks for some consumers, not build speed. tsdown makes the hardest correctness requirements (separate ESM and CommonJS type files, fixed extensions, a shared chunk across entries) its defaults instead of hand wiring. That directly removes the class of mistakes the current Rollup config already contains. For a solo maintainer, a dozen lines of config are worth more than the full control Rollup offers.

I had recommended keeping Rollup, because it's the more proven choice. tsdown is a reasonable pick with one tradeoff you should accept on purpose: it's young. That risk is contained in three ways. The version is pinned exactly, not with a caret. Every build is checked from the outside (publint and attw inspect the published shape, size-limit measures the real output, and the smoke fixtures install the real tarball), so a bad tsdown upgrade fails the check instead of reaching npm. And because Rolldown follows Rollup's output model, falling back to Rollup later is a config rewrite, not a code change.

The other decisions follow from the adoption goal. Shipping ESM and CommonJS avoids failing in test runners and older setups that still `require()`. The CDN global build serves vanilla users who try things in CodePen or a plain HTML file. A named only, minimal API (no `PhysicsEngine`, no default export) keeps the 1.0 promise small and avoids the `require('orbflow').default` trap. Fixed `.mjs`/`.cjs` extensions make every file's format obvious regardless of the consumer's setup.

## Package design

**Source entries** (after feature 1 trims the tree):
- `app/index.ts`: core public entry. Exports `OrbChart` and the four types only. Replaces today's `export * from './core/physics'` and drops `export default OrbChart` from `app/core/OrbChart.ts`.
- `app/react/index.ts`: React public entry. Exports the `OrbChart` component, `OrbChartProps`, and re-exports the four data types from the core. It imports the core through a relative path (so the bundler puts it in a shared chunk), never through the package name.

**Build outputs** (`dist/`):
| File | Format | Notes |
|---|---|---|
| `index.mjs`, `index.cjs` | ESM, CJS | core entry, imports the shared chunk |
| `react.mjs`, `react.cjs` | ESM, CJS | first line `"use client"`; imports the shared chunk; `react` external |
| shared chunk(s), named `chunk-[hash].mjs` / `.cjs` | ESM, CJS | core implementation, exactly once per format |
| `index.d.mts`, `index.d.cts`, `react.d.mts`, `react.d.cts` (+ shared type chunk if emitted) | types | bundled per entry and format |
| `orbflow.iife.js` | IIFE, minified | core only, global `OrbFlow`; built from a separate config with entry name `orbflow` |
| `*.map` | sourcemaps | `sourcesContent` included |

**tsdown config shape** (two configs in one file, array export, run in this order):
1. Library build: `entry: { index: 'app/index.ts', react: 'app/react/index.ts' }`, `outDir: 'dist'`, `clean: true`, `format: ['esm', 'cjs']`, `target: 'es2020'`, `platform: 'neutral'` (browser library, no Node built ins), `dts: true`, `fixedExtension: true` (must stay explicit: it is off by default for `neutral`), `sourcemap: true`, `external: ['react', 'react-dom', 'react/jsx-runtime']`, not minified (consumers' bundlers minify). Output options: `chunkFileNames: 'chunk-[hash]'` (extension added per format), and the directive banner:
   ```ts
   outputOptions: (o) => ({
     ...o,
     banner: (chunk) => (chunk.isEntry && chunk.name === 'react' ? '"use client";' : ''),
   }),
   ```
   Fallback, only if the installed tsdown version rejects a function banner: a short post build step in `scripts/add-use-client.mjs` that prepends `"use client";\n` to `dist/react.mjs` and `dist/react.cjs` (their sourcemaps shift by one line, which is acceptable). The directive never goes in source files, because bundlers strip or warn on module level directives and it could leak into the shared chunk.
2. CDN build: `entry: { orbflow: 'app/index.ts' }`, `outDir: 'dist'`, `clean: false` (so it never wipes the library build's output, since tsdown cleans by default), `format: ['iife']`, `globalName: 'OrbFlow'`, `minify: true`, `target: 'es2020'`, `platform: 'browser'`, `sourcemap: true`, `dts: false`. tsdown names it `orbflow.iife.js` from the entry name.

**Repo tsconfig** (development only): `moduleResolution: "bundler"`, `jsx: "react-jsx"` (the automatic runtime, so the build imports `react/jsx-runtime` and the external above applies), `include: ["app"]`. `app/shims.d.ts` is gone after feature 1; if it still exists, delete it before this build.

**Tool versions** (devDependencies, exact pins for the bundler, carets for the rest):
| Tool | Version rule |
|---|---|
| `tsdown` | exact pin to the latest 0.23 or newer release at build time (no caret) |
| `publint`, `@arethetypeswrong/cli`, `size-limit`, `@size-limit/preset-small-lib` | latest major at build time, caret |
| `typescript` | ^5 (already present) |
| `react`, `react-dom`, `@types/react` | ^18 (dev only, for building and fixtures) |
| Build machine Node | 22.18+ or 24.11+ (tsdown's own requirement; this machine has 24.11.1). Noted for contributors in the README; never enforced on consumers |
| Consumer Node (`engines.node`) | `>=18` (only matters for SSR imports and tooling; the code runs in browsers) |

**package.json shape** (the public contract):
```json
{
  "name": "orbflow",
  "version": "1.0.0",
  "sideEffects": false,
  "engines": { "node": ">=18" },
  "main": "./dist/index.cjs",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.cts",
  "unpkg": "./dist/orbflow.iife.js",
  "jsdelivr": "./dist/orbflow.iife.js",
  "exports": {
    ".": {
      "import": { "types": "./dist/index.d.mts", "default": "./dist/index.mjs" },
      "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
    },
    "./react": {
      "import": { "types": "./dist/react.d.mts", "default": "./dist/react.mjs" },
      "require": { "types": "./dist/react.d.cts", "default": "./dist/react.cjs" }
    },
    "./package.json": "./package.json"
  },
  "typesVersions": { "*": { "react": ["./dist/react.d.cts"] } },
  "files": ["dist", "README.md", "LICENSE"],
  "peerDependencies": { "react": "^18.0.0 || ^19.0.0" },
  "peerDependenciesMeta": { "react": { "optional": true } }
}
```
`typesVersions` exists only so `moduleResolution: node10` (common in older tsconfigs, including this repo's own) finds the `orbflow/react` types, which old resolution can't read from `exports`.

**Scripts**:
| Script | Runs |
|---|---|
| `build` | `tsdown` |
| `dev` | `tsdown --watch` |
| `check:package` | `publint && attw --pack . && node scripts/verify-dist.mjs` (attw on its full default profile, so node10, node16 ESM/CJS, and bundler are all checked) |
| `size` | `size-limit` |
| `smoke` | `node scripts/smoke.mjs` |
| `prepublishOnly` | `npm run lint && npm test && npm run build && npm run check:package && npm run size && npm run smoke` |

`npm test` (Jest) covers source level tests only and runs before the build, so it never reads `dist/`. Everything that inspects `dist/` runs after `build`, inside `check:package`, `size`, or `smoke`. The `prepare` script is removed: it rebuilt on every `npm install` in the repo and serves no purpose for a package published from the registry.

**`scripts/verify-dist.mjs`** (plain Node, no test framework, exits non zero on the first failure):
- Duplication: `dist/react.mjs` and `dist/react.cjs` contain no physics implementation (no `class PhysicsEngine` body), only an import or require of a `chunk-*` file (AC-4).
- Directive: line 1 of `dist/react.mjs` and `dist/react.cjs` is `"use client";`; no other `dist/*.mjs`, `*.cjs`, or `*.js` file contains it (AC-4).
- Sourcemaps: every `dist/*.mjs`, `*.cjs`, `*.js` has a sibling `.map` whose `sourcesContent` is a non empty array with no empty entries (AC-9).
- Syntax level: each JavaScript file parses as ES2020 (for example with `es-check es2020`, added as a dev dependency) (AC-9).
- CDN global: evaluate `dist/orbflow.iife.js` in a `node:vm` context with a stub `window` object as the global, then assert `window.OrbFlow.OrbChart` is a function and `window.OrbFlow.default` is undefined (AC-6).
- Surface: `Object.keys(await import('../dist/index.mjs'))` equals exactly `['OrbChart']`, and the React entry's keys equal exactly `['OrbChart']` (types are erased) (AC-3).

**Size budgets** (`.size-limit.json`, using `@size-limit/preset-small-lib`, with `gzip: true` set explicitly so the numbers match the README's "gzipped" claim). The preset bundles each entry with its relative imports, so the shared chunk is counted in both the core and React numbers:
| Name | Path | Import | Ignore | Limit |
|---|---|---|---|---|
| core | `dist/index.mjs` | `{ OrbChart }` | | 8 kB |
| react | `dist/react.mjs` | `{ OrbChart }` | `react`, `react-dom` | 9 kB |
| cdn | `dist/orbflow.iife.js` | whole file | | 8 kB |

Before writing the budgets, step 1 of the build measures the current minified gzip size of the core and records it under *Baseline* below, so the 8 kB figure is grounded in a real number.

**Baseline** (filled by `/develop` in build step 1): core minified gzip = _to be measured_.

**Smoke fixtures** (`test/consumers/`, each a tiny private project with its own `package.json` and no lockfile):
- `esm/`: `package.json` with `"type": "module"` and `react`/`react-dom` ^18 as dependencies. `index.mjs` imports both entries and asserts `typeof OrbChart === 'function'` for each, and that `globalThis.window` and `globalThis.document` are undefined after import (AC-1, AC-5).
- `cjs/`: `package.json` with `"type": "commonjs"`, same React dependencies. `index.cjs` requires both entries with the same assertions (AC-1, AC-5).
- `ts/`: `package.json` with `typescript` ^5, `react` ^18, `@types/react` ^18. `index.ts` imports both entries and uses `OrbChartConfig`, `OrbDataInput`, and `OrbChartProps`; `tsc --noEmit -p` runs against three configs, `tsconfig.node10.json`, `tsconfig.nodenext.json`, `tsconfig.bundler.json`, each with `strict: true`, `skipLibCheck: false`, `jsx: "react-jsx"` (AC-2).
- `bare/`: `package.json` with no dependencies at all. Installing the tarball here must print no peer warning and no `ERESOLVE` (AC-8).
- `scripts/smoke.mjs`: runs `npm pack` once; for each fixture runs `npm install --no-save --no-package-lock --ignore-scripts` (its own dependencies) and then the same flags with the tarball path; captures the install output for the `bare/` check; runs the fixture's check using the fixture's own binaries; deletes each fixture's `node_modules` and the tarball afterward; exits non zero on the first failure.

**Value sourcing**:
| Action | Value produced | Source |
|---|---|---|
| build | package version in tarball | `package.json` `version` |
| build | `"use client"` line | per chunk banner, chunk name `react` (decided above) |
| build | CDN global name | decided: `OrbFlow` |
| build | output target | decided: ES2020 |
| size | budgets | decided: 8 kB / 9 kB / 8 kB gzip, grounded by the measured baseline |
| build | tsdown version | exact pin to latest 0.23+ at build time, recorded in `package.json` |
| smoke | tarball under test | `npm pack` output of the current build |

**Key invariants**:
- Nothing in any module runs DOM code at import time; all DOM access happens inside the `OrbChart` constructor or methods.
- No public entry re-exports internals; a new public export is an API decision (minor version), never incidental.
- The React entry never imports `orbflow` by package name.
- tsdown is pinned to an exact version; upgrading it is a deliberate change that must pass the full `prepublishOnly` chain.

**Security model**: Not applicable (no runtime data, credentials, or network access). Supply chain note: zero runtime dependencies is itself a security property; keep it.

**Configuration required**: none (no env vars or secrets; npm publishing credentials belong to feature 11).

**Critical test scenarios**:
- Happy path: `npm run smoke` passes for the ESM, CommonJS, and TypeScript fixtures, verifies **AC-1**, **AC-2**, **AC-10**
- Types: `attw --pack .` and `publint` pass with no findings, verifies **AC-2**
- Surface: `verify-dist.mjs` finds exactly `OrbChart` exported at runtime from each entry, and the TypeScript fixture fails to compile a `PhysicsEngine` import or a default import (kept as `// @ts-expect-error` lines), verifies **AC-3**
- Duplication and directive: `verify-dist.mjs` finds no physics implementation in the React entries and `"use client"` on line 1 of the React entries only, verifies **AC-4**
- Server: the ESM and CommonJS fixtures import both entries in plain Node without throwing, verifies **AC-5**
- CDN: `verify-dist.mjs` evaluates the IIFE in a `node:vm` context and finds `window.OrbFlow.OrbChart`; `/check verify` opens a plain HTML page using it and sees a chart, verifies **AC-6**
- Failure: lowering a budget below the real size makes `npm run size` exit non zero, verifies **AC-7**
- Peer: the `bare/` fixture install output has no peer warning, verifies **AC-8**
- Sourcemaps and syntax: `verify-dist.mjs` passes the `sourcesContent` and ES2020 checks, verifies **AC-9**

## Build plan

Tracer Bullet: get one thin, real path from source to an installed tarball working first, then thicken it one output at a time. Every step leaves a package that installs.

1. Swap the build tool: measure and record the current core minified gzip size under *Baseline*; remove Rollup, its plugins, and `rollup.config.mjs`; add tsdown (exact pin, latest 0.23+); update the repo tsconfig (`bundler`, `react-jsx`); write the library config for the core entry only (ESM + CJS, ES2020, `fixedExtension`, dts, sourcemaps, `clean: true`, `chunk-[hash]` names); trim `app/index.ts` to `OrbChart` + types and drop the default export, satisfies **AC-3**, **AC-9**
2. Wire the core contract end to end: the `"."` exports map, `main`/`module`/`types`, `engines`, `sideEffects`, `files`; add publint + attw + a first `verify-dist.mjs` (surface and sourcemap checks) as `check:package`; add the smoke script with the ESM fixture only; get the whole thread green, satisfies **AC-1**, **AC-2**, **AC-5**, **AC-9**, **AC-10**, **AC-11**
3. Thicken with React: add the `react` entry to the same build (shared chunk), the `"use client"` banner (or its post build fallback), React externals, the `./react` export plus `typesVersions`, the optional peer dependency; extend the ESM fixture and `verify-dist.mjs` (duplication and directive checks) to the React entry, satisfies **AC-1**, **AC-3**, **AC-4**, **AC-8**
4. Thicken with the CDN build: add the IIFE config (`OrbFlow` global, minified, `clean: false`), the `unpkg`/`jsdelivr` fields, and the `node:vm` CDN check plus the ES2020 syntax check in `verify-dist.mjs`, satisfies **AC-6**, **AC-9**
5. Thicken with guards: size-limit with the three budgets (React ignored, gzip explicit); the CommonJS, TypeScript (three tsconfigs), and `bare/` fixtures; the full `prepublishOnly` chain; remove the `prepare` script, satisfies **AC-2**, **AC-7**, **AC-8**, **AC-10**, **AC-11**

## Consequences

**Positive**:
- Installs work the same in ESM, CommonJS, TypeScript (old and new resolution), bundlers, Next.js App Router, and a plain `<script>` tag.
- React users ship the core once; `OrbChart` from both entries is the same class within a format.
- Broken exports, wrong types, size regressions, and import time DOM access are caught before publish, not by users.
- A small public surface lets physics and rendering be refactored freely during 1.x.

**Negative / tradeoffs**:
- tsdown is young; an upgrade can change output. The exact pin and the outside checks contain this, but upgrades need care.
- Dual format packages carry the "dual package hazard": if one app loads orbflow through both `import` and `require`, it gets two core instances. Rare for a UI library, and harmless here (no global state), but worth knowing.
- The README's default import (`import OrbChart from 'orbflow'`) stops working; docs must change (feature 8).
- `typesVersions` is a small compatibility shim to keep until node10 resolution is no longer worth supporting.
- More scripts and fixtures to maintain: build, check, size, and smoke.

**Neutral**:
- `dist/` file names change (`.js` to `.mjs`/`.cjs`); nothing is published yet, so no consumer breaks.
- Vue, Svelte, and Angular later become new entries in the same library config, each with its own export and optional peer.
- The repo's own `tsconfig.json` should move to `moduleResolution: "bundler"` for development; publishing correctness no longer depends on it.

## Follow-up

- [ ] Scope feature 1 (trim to vanilla and React) should land first, or as the opening commit of this build.
- [ ] Feature 8 (README) must switch examples to named imports and add the CDN snippet using `window.OrbFlow.OrbChart`.
- [ ] Feature 11 (release pipeline) should run `prepublishOnly`'s chain in CI and reuse `npm run smoke` before publishing.
- [ ] `tsdown-migrate` (installed in `.claude/skills/`) is not yet listed in root `AGENTS.md` `## Agent skills`; it's project wide build tooling, so it belongs at root. `/audit` (feature 2) can record it, along with the declined skills: antfu/skills tsdown, the publint and size-limit skills.
- [ ] Features 4, 6, and 7 must stay within the 8 kB core budget; if one cannot, revisit the budget deliberately in this spec instead of raising the limit quietly.
