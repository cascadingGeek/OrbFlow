// Packs the real tarball and installs it into each consumer fixture under
// test/consumers/, then runs the fixture's `check` script (spec 0001, AC-10).
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const fixtures = ["esm", "cjs", "ts", "bare"];
// Fixtures whose tarball install must print no peer warning (AC-8).
const quietInstall = new Set(["bare"]);
// Set ORBFLOW_REACT_MAJOR (for example 19) to test the fixtures against that
// React major, including its @types/react (spec 0003, AC-14).
const reactMajor = process.env.ORBFLOW_REACT_MAJOR;
const reactPins = ["react", "react-dom", "@types/react"];
const installFlags = "--no-save --no-package-lock --ignore-scripts";

// Runs a shell command and returns its combined stdout and stderr. Throws
// with that output attached when the command exits non zero.
function run(command, cwd) {
  const result = spawnSync(command, { cwd, encoding: "utf8", shell: true });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (result.status !== 0) {
    throw Object.assign(new Error(`${command} exited ${result.status}`), {
      output,
    });
  }
  return output;
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
      const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
      const pins = reactMajor
        ? reactPins
            .filter((dep) => pkg.dependencies?.[dep])
            .map((dep) => `${dep}@${reactMajor}`)
            .join(" ")
        : "";
      const installOutput = run(
        `npm install ${installFlags} "${tarball}" ${pins}`,
        dir,
      );
      if (quietInstall.has(name) && /peer|ERESOLVE/i.test(installOutput)) {
        throw Object.assign(
          new Error("tarball install printed a peer warning"),
          {
            output: installOutput,
          },
        );
      }
      if (pkg.scripts?.check) run("npm run check", dir);
      console.log(`smoke: ${name} OK`);
    } catch (error) {
      failed = true;
      console.error(
        `smoke: ${name} failed: ${error.message}\n${error.output ?? ""}`,
      );
      break;
    } finally {
      rmSync(join(dir, "node_modules"), { recursive: true, force: true });
    }
  }
} finally {
  rmSync(packDir, { recursive: true, force: true });
}

if (failed) process.exit(1);
