# Verify: Package build and exports · spec 0001 · updated 2026-10-12

_Steps derived from spec 0001 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual

- [x] Serve a plain HTML page that loads `dist/orbflow.iife.js` with a classic `<script>` tag and calls `new OrbFlow.OrbChart("#chart")`, `setData([...])`, `start()` → orbs render and move, no console errors → AC-6
- [x] Drop `<OrbChart>` from `orbflow/react` (installed from the packed tarball) into a Next.js App Router page with no wrapper file → page renders on the server without errors, the chart appears after hydration → AC-1, AC-4, AC-5
- [x] In a project without React, `npm install <tarball>` → no peer warning and no `ERESOLVE` in the output → AC-8

## Commands

- [x] `npm run build` → `dist/` holds `index.{mjs,cjs}`, `react.{mjs,cjs}`, one `chunk-*.mjs` and one `chunk-*.cjs`, types `index.d.{mts,cts}`, `react.d.{mts,cts}`, and `orbflow.iife.js` with maps → AC-4, AC-9
- [x] `npm run check:package` → `publint` "All good", `attw --pack .` green for `orbflow` and `orbflow/react` under node10, node16 (CJS and ESM), and bundler, `verify-dist: 7 files OK` → AC-2, AC-3, AC-4, AC-6, AC-9
- [x] `head -1 dist/react.mjs dist/react.cjs` → both print `"use client";`; `grep -l "use client" dist/index.* dist/chunk-* dist/orbflow.iife.js` → no matches → AC-4
- [x] `node -e "import('./dist/index.mjs').then(m => console.log(Object.keys(m)))"` → `[ 'OrbChart' ]`, and the same for `dist/react.mjs` → AC-3
- [x] `npm run size` → core ≤ 8 kB, react ≤ 9 kB, cdn ≤ 8 kB gzip; lower any limit in `.size-limit.json` below the real size → exits non zero → AC-7
- [x] `npm run smoke` → `esm`, `cjs`, `ts`, `bare` all OK; break a fixture assertion → exits non zero → AC-1, AC-2, AC-5, AC-8, AC-10
- [x] `npm run prepublishOnly` → runs lint, typecheck, test, build, check:package, size, smoke in that order and passes → AC-11
- [x] `node -p "require('./package.json').sideEffects"` → `false`; `dependencies` is absent; `peerDependenciesMeta.react.optional` is `true` → AC-8, AC-11

## Value sourcing

- [x] Bump `version` in `package.json`, run `npm run smoke` → the packed tarball name carries the new version (then revert) → package version
- [x] `"use client"` appears only on the chunk named `react` (see the directive command above) → directive source
- [x] `window.OrbFlow` is the only global the IIFE defines → CDN global name
- [x] `verify-dist` es-check passes as ES2020; add a `??=` line to a chunk and it fails → output target
- [x] `npm ls tsdown` → exactly `0.23.1`, matching the exact pin in `package.json` → tsdown version
- [x] Size budgets match the spec (8 / 9 / 8 kB gzip) against the measured 3.55 kB baseline → budgets
- [x] `npm run smoke` prints `packed orbflow-<version>.tgz` from the current build → tarball under test

## Acceptance-criteria coverage

- AC-1: smoke `esm` and `cjs`, Next.js page · AC-2: attw, smoke `ts` (node10, nodenext CJS and ESM, bundler) · AC-3: surface command, `verify-dist`, `ts` fixture `@ts-expect-error` lines · AC-4: directive command, `verify-dist` duplication check · AC-5: smoke `esm`/`cjs` no DOM asserts · AC-6: HTML page, `verify-dist` CDN global · AC-7: size command and the lowered limit · AC-8: `bare` fixture, no React install · AC-9: build listing, `verify-dist` sourcemap and ES2020 checks · AC-10: smoke · AC-11: prepublishOnly, `sideEffects`
