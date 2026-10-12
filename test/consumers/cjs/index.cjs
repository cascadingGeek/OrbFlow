// Requires the packed orbflow in plain Node, with no DOM (AC-1, AC-5).
const assert = require("node:assert/strict");
const { OrbChart } = require("orbflow");
const { OrbChart: ReactOrbChart } = require("orbflow/react");

assert.equal(typeof OrbChart, "function", "orbflow: OrbChart");
assert.equal(typeof ReactOrbChart, "function", "orbflow/react: OrbChart");
assert.equal(globalThis.window, undefined, "window defined after require");
assert.equal(globalThis.document, undefined, "document defined after require");
