// Imports the packed orbflow in plain Node, with no DOM (AC-1, AC-5).
import assert from "node:assert/strict";
import { OrbChart } from "orbflow";
import { OrbChart as ReactOrbChart } from "orbflow/react";

assert.equal(typeof OrbChart, "function", "orbflow: OrbChart");
assert.equal(typeof ReactOrbChart, "function", "orbflow/react: OrbChart");
assert.equal(globalThis.window, undefined, "window defined after import");
assert.equal(globalThis.document, undefined, "document defined after import");
