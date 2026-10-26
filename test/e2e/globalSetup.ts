import { existsSync } from "node:fs";
import { build } from "rolldown";

// The suite tests what ships: it needs dist/ (npm run test:e2e builds it),
// and bundles a tiny React app against dist/react.mjs.
export default async function globalSetup() {
  for (const file of ["dist/orbflow.iife.js", "dist/react.mjs"]) {
    if (!existsSync(file)) {
      throw new Error(`${file} is missing. Run \`npm run build\` first.`);
    }
  }
  await build({
    input: "test/e2e/fixtures/react-app.tsx",
    output: {
      file: "node_modules/.cache/orbflow-e2e/react-app.js",
      format: "iife",
    },
    transform: { define: { "process.env.NODE_ENV": '"production"' } },
    logLevel: "silent",
  });
}
