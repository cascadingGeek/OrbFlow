// Imports the packed orbflow in plain Node, with no DOM (AC-1, AC-5).
import assert from "node:assert/strict";
import { OrbChart } from "orbflow";

assert.equal(typeof OrbChart, "function", "orbflow: OrbChart");
assert.equal(globalThis.window, undefined, "window defined after import");
assert.equal(globalThis.document, undefined, "document defined after import");
