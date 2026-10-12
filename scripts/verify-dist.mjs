// Checks the built dist/ against spec 0001. Plain Node, exits non zero on
// the first failure. Runs after `npm run build`, inside `check:package`.
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const dist = fileURLToPath(new URL("../dist/", import.meta.url));

function fail(message) {
  console.error(`verify-dist: ${message}`);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

const jsFiles = readdirSync(dist).filter((f) => /\.(mjs|cjs|js)$/.test(f));
assert(
  jsFiles.length > 0,
  "dist/ has no JavaScript files, run the build first",
);

// Surface: each entry exports exactly `OrbChart` at runtime (AC-3).
async function checkSurface(file) {
  const mod = await import(pathToFileURL(join(dist, file)).href);
  const keys = Object.keys(mod).sort();
  assert(
    keys.length === 1 && keys[0] === "OrbChart",
    `${file} exports [${keys.join(", ")}], expected exactly [OrbChart]`,
  );
}
await checkSurface("index.mjs");
await checkSurface("react.mjs");

// Duplication: the React entries import the core from a shared chunk and
// carry no physics implementation of their own (AC-4).
const physicsBody = /class PhysicsEngine\b|PhysicsEngine = class\b/;
for (const file of ["react.mjs", "react.cjs"]) {
  const code = readFileSync(join(dist, file), "utf8");
  assert(!physicsBody.test(code), `${file} contains its own copy of the core`);
  assert(
    /["']\.\/chunk-[\w-]+\.(mjs|cjs)["']/.test(code),
    `${file} does not import a shared chunk`,
  );
}

// Directive: `"use client"` is line 1 of the React entries and nowhere else (AC-4).
for (const file of jsFiles) {
  const code = readFileSync(join(dist, file), "utf8");
  const isReactEntry = file === "react.mjs" || file === "react.cjs";
  if (isReactEntry) {
    assert(
      code.split("\n")[0].trim() === '"use client";',
      `${file} does not start with "use client"`,
    );
  } else {
    assert(
      !/["']use client["']/.test(code),
      `${file} contains a "use client" directive`,
    );
  }
}

// Sourcemaps: every JavaScript file with code of its own has a map with
// embedded sources (AC-9). A pure re export entry (only import, export, and
// require lines pointing at a chunk) has no original code, so the bundler
// emits no map for it; the chunk it points to carries the map instead.
const reExportLine = [
  /^export \{[^}]*\} from "\.\/chunk-[\w-]+\.mjs";$/,
  /^Object\.defineProperty\(exports, Symbol\.toStringTag, \{ value: "Module" \}\);$/,
  /^const \w+ = require\("\.\/chunk-[\w-]+\.cjs"\);$/,
  /^exports\.\w+ = \w+\.\w+;$/,
];
function isPureReExport(code) {
  return code
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .every((line) => reExportLine.some((pattern) => pattern.test(line)));
}

for (const file of jsFiles) {
  const mapPath = join(dist, `${file}.map`);
  if (!existsSync(mapPath)) {
    assert(
      isPureReExport(readFileSync(join(dist, file), "utf8")),
      `${file} has no sourcemap`,
    );
    continue;
  }
  const map = JSON.parse(readFileSync(mapPath, "utf8"));
  const sources = map.sourcesContent;
  assert(
    Array.isArray(sources) &&
      sources.length > 0 &&
      sources.every((s) => typeof s === "string" && s.length > 0),
    `${file}.map is missing sourcesContent`,
  );
}

console.log(`verify-dist: ${jsFiles.length} files OK`);
