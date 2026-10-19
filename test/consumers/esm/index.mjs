// Imports the packed orbflow in plain Node, with no DOM (AC-1, AC-5).
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { OrbChart } from "orbflow";
import { OrbChart as ReactOrbChart } from "orbflow/react";

assert.equal(typeof OrbChart, "function", "orbflow: OrbChart");
// The React entry is a forwardRef component: it renders a plain div on the
// server (spec 0003 AC-1).
assert.equal(
  renderToString(createElement(ReactOrbChart, { data: [], className: "c" })),
  '<div class="c" style="width:100%;height:100%"></div>',
  "orbflow/react: server render",
);
assert.equal(globalThis.window, undefined, "window defined after import");
assert.equal(globalThis.document, undefined, "document defined after import");
