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

// Sourcemaps: every JavaScript file has a map with embedded sources (AC-9).
for (const file of jsFiles) {
  const mapPath = join(dist, `${file}.map`);
  assert(existsSync(mapPath), `${file} has no sourcemap`);
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
