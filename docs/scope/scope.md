# Scope: OrbFlow

A lightweight, physics based bubble (orb) chart library with a zero dependency core. Built for developers who want a chart that feels more alive than a standard bar or pie, and who need it to install fast and run reliably in production.

**Release plan:** v1.0.0 supports vanilla JavaScript and React only, with a stable API. Later minor releases add one framework each, without breaking changes: v1.1 Vue, v1.2 Svelte, v1.3 Angular. The goal of v1 is developer adoption and credibility, so every v1 feature is about being easy to install, easy to integrate, and solid in production. No new chart features before 1.0.0 is on npm.
**Build approach:** Tracer Bullet (each feature goes end to end through core, React wrapper, types, tests, and docs, so the package stays shippable after every slice).
**Workflow:** Beta (after `/develop`, run `/check verify`, then `/test`). The project default level of rigor. `/architect` is the recommended first stop for a feature with a real decision, but skippable when you already know the build. Any feature can carry its own tag (e.g. `· GA`) to do more or less.

_These are recommendations to keep your build orderly, not requirements. Skip anything that does not fit: if you already know how to build a feature, use `/develop` and skip `/architect`. You decide when a feature is `done`._

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| A | Physics core and canvas renderer | Existing | in-progress |
| B | React wrapper | Existing | in-progress |
| 1 | Trim to vanilla and React | Foundation | done |
| 2 | Coding standards and tooling | Foundation | done |
| 3 | Package build and exports | Foundation | in-progress |
| 4 | Production ready core lifecycle | Slice 1 | planned |
| 5 | Production ready React component | Slice 1 | planned |
| 6 | Accessibility and reduced motion | Slice 2 | planned |
| 7 | Performance and idle behavior | Slice 2 | planned |
| 8 | README and API reference | Slice 3 | planned |
| 9 | Runnable examples | Slice 3 | planned |
| 10 | Live demo page | Slice 3 | planned |
| 11 | Release pipeline and 1.0.0 publish | Slice 3 | planned |

## Already built

### A. Physics core and canvas renderer · in-progress
The vanilla `OrbChart` class, physics engine, and canvas renderer. It works on screen, but it is not production ready yet: `destroy()` leaves the resize observer and canvas listeners attached, every `setData` call reshuffles all orbs, and there is no touch support even though the README promises it. Rows 4, 6, and 7 finish it. code in `app/core/`, `app/renderer/`

### B. React wrapper · in-progress
`<OrbChart>` wraps the core class. Open gaps: click and hover callbacks are captured once on mount (later props are ignored), the config effect runs on every render, and nothing marks it safe for server rendered React. Row 5 finishes it. code in `app/react/`

## Foundations

### 1. Trim to vanilla and React · done
Remove everything that is not vanilla or React so v1 has one clear story. This is the cleanup you asked for, done as the first build step.
**Done when:** `app/vue/`, `app/svelte/`, `app/angular/`, and `app/shims.d.ts` are gone; `package.json` has no Vue, Svelte, or Angular exports, peer dependencies, dev dependencies, or keywords; the build config no longer mentions them; stale files under `dist/` are cleared; the README drops those sections and adds a short roadmap (1.1 Vue, 1.2 Svelte, 1.3 Angular); `npm run build` still succeeds.
- [x] `/develop trim to vanilla and react`
code in `app/`, `package.json`, `rollup.config.mjs`, `README.md`

### 2. Coding standards and tooling · done
Capture the project conventions, then make lint, tests, and version control actually work. Today `npm run lint` and `npm test` have no config behind them, there is no LICENSE file even though `package.json` ships one, and the folder is not a git repository.
**Done when:** root `AGENTS.md` reflects the trimmed project; the folder is under version control with build output ignored; a LICENSE file exists; lint and the test runner run clean on an empty suite; `prepublishOnly` passes.
- [x] Capture conventions and tooling choices: `/audit`
- [x] Build it: `/develop tooling`
code in `eslint.config.mjs`, `jest.config.cjs`, `.prettierrc.json`, `.github/workflows/ci.yml`, `LICENSE`, `package.json`

### 3. Package build and exports · in-progress
Decide the exact published shape so installs just work in every common bundler and in server rendered React. Covers module formats, the `exports` map (types first), whether the React entry reuses the core instead of bundling a second copy, tree shaking and side effects, and a bundle size budget.
**Done when:** `orbflow` and `orbflow/react` resolve with correct types in ESM, CommonJS, and TypeScript projects; the React entry does not duplicate the core; a size budget is recorded and checked in the build.
- [x] Design it (spec): `/architect package build and exports`
- [ ] Build it: `/develop package build and exports`
   - [x] Core thread on tsdown: Rollup removed, core ESM + CJS build, exports map, publint + attw + dist verifier, ESM smoke fixture green (AC-1, AC-2, AC-3, AC-5, AC-9, AC-10, AC-11)
   - [ ] React entry: shared chunk, `"use client"` banner, `./react` export, optional React peer (AC-1, AC-3, AC-4, AC-8)
   - [ ] CDN build: minified `window.OrbFlow` IIFE plus its checks (AC-6, AC-9)
   - [ ] Guards: size budgets, CommonJS, TypeScript, and bare fixtures, full `prepublishOnly` chain (AC-2, AC-7, AC-8, AC-10, AC-11)
- [ ] Verify it: `/check verify package build and exports`
- [ ] Test it: `/test package build and exports`
Spec [0001](../specs/0001-package-build-exports.md) · code in `tsdown.config.ts`, `package.json`, `scripts/`, `test/consumers/`, `app/index.ts`

## Slice 1: Production ready core and React

### 4. Production ready core lifecycle · needs a decision
Make the vanilla chart safe to create, update, and destroy many times in a real app. Includes how data updates behave (match orbs by `id` and animate size changes instead of reshuffling), input validation, and pointer and touch input.
**Done when:** `destroy()` removes every listener and observer with no leaks; calling `setData` with changed values keeps existing orbs in place and animates their size; bad input (empty list, zero, negative, or non numeric values, duplicate ids) is handled with a clear result instead of a crash; tap works on touch devices.
- [ ] Design it (spec): `/architect production ready core lifecycle`

### 5. Production ready React component · needs a decision
Make `<OrbChart>` behave like a well made React component: safe under server rendering, correct in strict mode, always calling the latest callbacks, and offering a way to pause, resume, or reach the chart instance.
**Done when:** it renders in a server rendered React 18+ app without errors; mounting twice in strict mode leaves one chart and no leaks; changing `onOrbClick` takes effect without a remount; inline config objects do not cause work on every render; a ref gives access to start, pause, and the current data.
- [ ] Design it (spec): `/architect production ready react component`

## Slice 2: Trust and polish

### 6. Accessibility and reduced motion · needs a decision
A canvas is invisible to screen readers, and constant motion bothers some users. Give the chart an accessible name, a text alternative for its data, keyboard reachable orbs, and respect for the reduced motion setting.
**Done when:** a screen reader announces the chart and can reach each orb's label and value; orbs can be focused and activated from the keyboard; with reduced motion on, orbs settle and stay still.
- [ ] Design it (spec): `/architect accessibility and reduced motion`

### 7. Performance and idle behavior · needs a decision
Keep the chart smooth and cheap: stop animating when it is off screen or the tab is hidden, and know how many orbs it can handle at a smooth frame rate.
**Done when:** the animation loop stops while the chart is hidden and resumes when visible; a documented orb count runs smoothly on a mid range laptop and phone; the limit is stated in the docs.
- [ ] Design it (spec): `/architect performance and idle behavior`

## Slice 3: Launch kit

### 8. README and API reference
Rewrite the docs to match the real code, so the first five minutes go smoothly. Today the README lists defaults (for example `maxRadius` 200, `damping` 0.995) that differ from the code.
**Done when:** every option, default, method, and type in the README matches the code; there is a quick start for vanilla and for React (including server rendered React); there is a short troubleshooting section and a roadmap.
- [ ] `/develop readme and api reference`

### 9. Runnable examples · needs a decision
Small example apps in the repo that a developer can copy and run in under a minute: one vanilla, one client side React, one server rendered React.
**Done when:** each example installs and runs with one command against the local package and shows a working chart with click handling.
- [ ] Design it (spec): `/architect runnable examples`

### 10. Live demo page · needs a decision
A hosted page that shows the orbs moving, with a few live controls, linked from the README and the npm page. Visual libraries spread through demos.
**Done when:** a public URL shows the chart with editable data and a few config controls, and it uses the published package.
- [ ] Design it (spec): `/architect live demo page`

### 11. Release pipeline and 1.0.0 publish · needs a decision
A repeatable, trustworthy way to publish: semantic versioning, a changelog, automated checks before publish, and the first 1.0.0 release on npm.
**Done when:** a CHANGELOG exists; a release runs lint, tests, build, and the size check before publishing; `orbflow@1.0.0` is on npm and installs cleanly in a fresh vanilla project and a fresh React project.
- [ ] Design it (spec): `/architect release pipeline and 1.0.0 publish`

## Deferred
Out of scope for v1, kept so the plan stays honest. Each is a minor release with no breaking changes, started once v1 shows traction.
- **Vue support (v1.1)**: a Vue 3 component on the same core · needs a decision
- **Svelte support (v1.2)**: a Svelte component on the same core · needs a decision
- **Angular support (v1.3)**: an Angular component on the same core · needs a decision

## Legend

**The decision box.** Every feature carries exactly one, the sub task whose label ends with `(spec)`. Its wording varies, so skills locate it by that `(spec)` suffix, never by an exact label. Every other box is an execution box and `/architect` never ticks one.

**Feature lifecycle**: the scope updates as a feature moves; each row is what it shows and who sets it:

| State | Set by | The feature shows |
|---|---|---|
| `planned` · needs a decision | `/scope` | one box: `Design it (spec): /architect <feature>` |
| `in-progress` (designed) | **`/architect` at spec capture** | `Design it` ticked; spec linked; `Build it: /develop <feature>` + **2 to 5 milestones**; the tier's closing boxes (`Verify it` Alpha+, `Test it` Beta+, `Review it` + `Document it` GA); any surfaced follow up enrolled |
| `in-progress` (building) | `/develop` | milestone sub boxes tick one by one; code pointer filled |
| `in-progress` (verified) | `/check verify` | `Build it` + milestones ticked; `Verify it` ticked |
| `done` | **you, when you decide it is** (any skill sets it when you say so); `/sync` reconciles | boxes you ran ticked, skipped ones marked skipped; the tier's last stage (`Prototype` → after `/develop`; `Alpha` → after `/check verify`; `Beta`/`GA` → after `/test`) is the suggested point to call it done; `/sync` captures conventions |

- **Next step** = the first unticked box (always a command or a tracked milestone).
- **needs a decision** = run `/architect` first; otherwise straight to `/develop` (or `/audit` for standards and tooling). The tag drops once the spec is captured.
- **Atomic build tasks live in the spec's `## Build plan`, not here**: the scope carries only the milestone rollup.
- **Status** `planned` → `in-progress` → `done`, plus `existing` (pre workflow) and `dropped` (de scoped, kept for history).
- **Approach tag** beside a heading (e.g. `· Facade`) overrides the project default for that feature; no tag = inherits it.
- **Workflow tier tag** beside a heading (e.g. `· GA`, `· Prototype`) sets that one feature's rigor above or below the project default; no tag inherits the default.
- **Workflow** (header line) is the project default, what runs after `/develop`: **Prototype** = nothing; **Alpha** = `/check verify`; **Beta** = `/check verify` then `/test`; **GA** = adds a fresh model `/check review` then `/document`. A feature built on an unratified decision (an `Assumed` spec) stays flagged, but that never blocks `done`.
- **Pointer line** (`spec <n> · code in <path>`): the spec link added by `/architect`, the code path by `/develop`.
