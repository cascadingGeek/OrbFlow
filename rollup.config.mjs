import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import peerDepsExternal from "rollup-plugin-peer-deps-external";
import dts from "rollup-plugin-dts";

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const packageJson = require("./package.json");

export default [
  // Core build (vanilla JS/TS)
  {
    input: "app/index.ts",
    output: [
      {
        file: packageJson.main, // dist/index.js
        format: "cjs",
        sourcemap: true,
      },
      {
        file: packageJson.module, // dist/index.esm.js
        format: "esm",
        sourcemap: true,
      },
    ],
    plugins: [
      peerDepsExternal(),
      resolve(),
      commonjs(),
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: true,
        declarationDir: "./dist",
        exclude: ["**/*.test.ts", "**/*.test.tsx", "app/react/**/*"],
      }),
    ],
  },

  // React build - THIS CREATES THE .JS FILES
  {
    input: "app/react/index.ts",
    output: [
      {
        file: "dist/react.js", // Not dist/react/index.js
        format: "cjs",
        sourcemap: true,
      },
      {
        file: "dist/react.esm.js", // Not dist/react/index.esm.js
        format: "esm",
        sourcemap: true,
      },
    ],
    external: ["react", "react-dom"],
    plugins: [
      peerDepsExternal(),
      resolve(),
      commonjs(),
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: false, // Add this
        declarationMap: false, // Add this
      }),
    ],
  },

  // Type definitions for Core
  {
    input: "dist/index.d.ts",
    output: [{ file: "dist/index.d.ts", format: "es" }],
    plugins: [dts()],
  },

  // Type definitions for React
  {
    input: "dist/react/index.d.ts",
    output: [{ file: "dist/react.d.ts", format: "es" }],
    plugins: [dts()],
    external: [/\.css$/],
  },
];
