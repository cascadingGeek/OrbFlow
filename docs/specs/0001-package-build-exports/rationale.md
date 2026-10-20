# 0001. Package build and exports for orbflow v1: rationale

Decision record for [spec 0001](./index.md).

## Context

orbflow is a zero dependency canvas bubble chart library. v1.0.0 targets vanilla JavaScript and React 18+ only, and its goal is adoption: a developer should install it and see a chart in minutes, in whatever setup they already have. The most common reason a new library gets abandoned on day one is not missing features. It's an install that fails to resolve, types that show red squiggles, or a crash in a server rendered React app.

The current build (Rollup, `rollup.config.mjs`) has real problems. The React bundle compiles a second full copy of the core (`PhysicsEngine` appears inside `dist/react.esm.js`), so React users who also import from `orbflow` ship the core twice, and the two `OrbChart` classes are not the same class. `dist/index.d.ts` is not a bundled type file; it points at relative paths. The `exports` map lists `import`/`require` before `types` and still advertises Vue, Svelte, and Angular entries that point at `.d.ts` files. The core entry exports `PhysicsEngine` (and both a named and a default `OrbChart`), which would freeze internals into the 1.0 stability promise. There is no size budget, no package shape check, and nothing proves the published tarball works in a consumer project.

Forces: the package must be safe under server rendering (no `window` or `document` at import time, and a `"use client"` marker for React Server Components). It must keep the "lightweight" claim honest as later features (lifecycle, accessibility, touch) add code. The team is one developer, so the build must be small to own and must fail loudly instead of silently shipping a broken package. Anything exported in 1.0 must stay stable until 2.0, while Vue, Svelte, and Angular arrive later as additive minor releases (1.1, 1.2, 1.3).

Prerequisite: scope feature 1 (trim to vanilla and React) removes the Vue, Svelte, and Angular sources and package fields. This spec assumes it has landed, or lands as the first step of this build.

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

## Rationale

The real risk for a v1 launch is an install that silently breaks for some consumers, not build speed. tsdown makes the hardest correctness requirements (separate ESM and CommonJS type files, fixed extensions, a shared chunk across entries) its defaults instead of hand wiring. That directly removes the class of mistakes the current Rollup config already contains. For a solo maintainer, a dozen lines of config are worth more than the full control Rollup offers.

I had recommended keeping Rollup, because it's the more proven choice. tsdown is a reasonable pick with one tradeoff you should accept on purpose: it's young. That risk is contained in three ways. The version is pinned exactly, not with a caret. Every build is checked from the outside (publint and attw inspect the published shape, size-limit measures the real output, and the smoke fixtures install the real tarball), so a bad tsdown upgrade fails the check instead of reaching npm. And because Rolldown follows Rollup's output model, falling back to Rollup later is a config rewrite, not a code change.

The other decisions follow from the adoption goal. Shipping ESM and CommonJS avoids failing in test runners and older setups that still `require()`. The CDN global build serves vanilla users who try things in CodePen or a plain HTML file. A named only, minimal API (no `PhysicsEngine`, no default export) keeps the 1.0 promise small and avoids the `require('orbflow').default` trap. Fixed `.mjs`/`.cjs` extensions make every file's format obvious regardless of the consumer's setup.

## Revision: raising the size budgets (2026-10-20)

**Context**: AC-7 set the budgets at 8 kB (core), 9 kB (react), and 8 kB (cdn), grounded in a 3.55 kB baseline, with a follow up saying features 4, 6, and 7 should stay inside them or revisit them on purpose. Feature 6 (spec 0004, accessibility and reduced motion) landed at core 8.69 kB, react 9.23 kB, and cdn 8.75 kB, all over.

**Options considered**:
1. Raise the budgets to 9, 10, and 9 kB. Keeps every feature and the small classes that hold `OrbChart.ts` under its line cap.
2. Trim about 0.8 kB gzip by removing structure and shortening code. Keeps 8, 9, and 8 kB, but risks pushing `OrbChart.ts` back over its cap and making the code harder to read.
3. Leave the check failing and decide later. Keeps the numbers honest but leaves `npm run size` red and `prepublishOnly` blocked.

**Decision**: option 1, chosen by the engineer. The size still sits far below what most chart libraries ship, the extra weight buys real accessibility, and the review habit the follow up asked for (raise it in this spec, never quietly) is what this section is.

**Tradeoff**: the room left is small (about 0.3 kB in core), so feature 7 will meet the same question again unless it measures first and stays inside.
