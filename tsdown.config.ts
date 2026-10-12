import { defineConfig } from "tsdown";

export default defineConfig([
  // Library build: ESM + CJS with per format types (spec 0001).
  {
    entry: { index: "app/index.ts", react: "app/react/index.ts" },
    outDir: "dist",
    clean: true,
    format: ["esm", "cjs"],
    target: "es2020",
    platform: "neutral",
    dts: true,
    // Off by default for `neutral`; keeps .mjs/.cjs names stable.
    fixedExtension: true,
    sourcemap: true,
    deps: { neverBundle: ["react", "react-dom", "react/jsx-runtime"] },
    outputOptions: (options) => ({
      ...options,
      // Keep tsdown's per format extension (.mjs, .cjs, .d.cts), rename the stem.
      chunkFileNames:
        typeof options.chunkFileNames === "string"
          ? options.chunkFileNames.replace("[name]-", "chunk-")
          : options.chunkFileNames,
      // The directive lives only on the React entry, never in source.
      banner: (chunk) =>
        chunk.isEntry && chunk.name === "react" ? '"use client";' : "",
    }),
  },
  // CDN build: minified core for a classic <script> tag, global `OrbFlow`.
  {
    entry: { orbflow: "app/index.ts" },
    outDir: "dist",
    // Never wipe the library build's output.
    clean: false,
    format: ["iife"],
    globalName: "OrbFlow",
    minify: true,
    target: "es2020",
    platform: "browser",
    sourcemap: true,
    dts: false,
  },
]);
