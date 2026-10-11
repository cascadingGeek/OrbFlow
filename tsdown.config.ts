import { defineConfig } from "tsdown";

export default defineConfig([
  // Library build: ESM + CJS with per format types (spec 0001).
  {
    entry: { index: "app/index.ts" },
    outDir: "dist",
    clean: true,
    format: ["esm", "cjs"],
    target: "es2020",
    platform: "neutral",
    dts: true,
    // Off by default for `neutral`; keeps .mjs/.cjs names stable.
    fixedExtension: true,
    sourcemap: true,
    outputOptions: {
      chunkFileNames: "chunk-[hash]",
    },
  },
]);
