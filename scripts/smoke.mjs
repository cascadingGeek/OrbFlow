// Packs the real tarball and installs it into each consumer fixture under
// test/consumers/, then runs the fixture's `check` script (spec 0001, AC-10).
import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const fixtures = ["esm"];
const installFlags = "--no-save --no-package-lock --ignore-scripts";

function run(command, cwd) {
  return execSync(command, { cwd, encoding: "utf8", stdio: "pipe" });
}

const packDir = mkdtempSync(join(tmpdir(), "orbflow-smoke-"));
let failed = false;

try {
  const [packed] = JSON.parse(
    run(
      `npm pack --json --ignore-scripts --pack-destination "${packDir}"`,
      root,
    ),
  );
  const tarball = join(packDir, packed.filename);
  console.log(`smoke: packed ${packed.filename}`);

  for (const name of fixtures) {
    const dir = join(root, "test", "consumers", name);
    try {
      run(`npm install ${installFlags}`, dir);
      run(`npm install ${installFlags} "${tarball}"`, dir);
      const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
      if (pkg.scripts?.check) run("npm run check", dir);
      console.log(`smoke: ${name} OK`);
    } catch (error) {
      failed = true;
      const output = [error.stdout, error.stderr].filter(Boolean).join("\n");
      console.error(`smoke: ${name} failed\n${output || error.message}`);
      break;
    } finally {
      rmSync(join(dir, "node_modules"), { recursive: true, force: true });
    }
  }
} finally {
  rmSync(packDir, { recursive: true, force: true });
}

if (failed) process.exit(1);
