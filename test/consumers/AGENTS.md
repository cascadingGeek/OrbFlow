# Consumer smoke fixtures

Tiny private projects that install the real packed tarball, the way a user would. `npm run smoke` (`scripts/smoke.mjs`) drives them; spec 0001 (AC-1, AC-2, AC-5, AC-8, AC-10) is why they exist.

## Fixtures

- `esm/`: `"type": "module"`, imports both entries, asserts no `window`/`document` after import.
- `cjs/`: `"type": "commonjs"`, the same checks through `require`.
- `ts/`: type checks both entries under `tsconfig.node10.json`, `tsconfig.nodenext.json` (from `index.ts` as CJS and `index.mts` as ESM), and `tsconfig.bundler.json`, all `strict` with `skipLibCheck: false`. `@ts-expect-error` lines prove internals and default imports are rejected.
- `bare/`: no dependencies; the tarball install must print no `peer` or `ERESOLVE` line (React stays an optional peer).

## Conventions

- Each fixture is `private`, has no lockfile, and lists only what it needs in `dependencies`.
- A fixture's assertions live in a `check` script in its `package.json`; `smoke.mjs` runs it with the fixture's own binaries.
- To add a fixture: create the folder, add it to the `fixtures` list in `scripts/smoke.mjs` (and to `quietInstall` if its install must be warning free).
- `smoke.mjs` installs with `--no-save --no-package-lock --ignore-scripts` and deletes each `node_modules` afterwards, so nothing here should be committed except source and `package.json`.
- Run after `npm run build`; it packs whatever `dist/` holds.

_Drafted by /sync from the introducing change, worth a quick human pass._
