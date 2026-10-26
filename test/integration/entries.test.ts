import * as core from "../../app/index";
import * as react from "../../app/react/index";

// Source level checks of the public surface (spec 0001), in plain Node with no
// DOM. The built package is checked by `check:package` and `smoke`.
describe("public entries", () => {
  it("core entry exports exactly OrbChart at runtime (covers: AC-3)", () => {
    expect(Object.keys(core).sort()).toEqual(["OrbChart"]);
  });

  it("React entry exports exactly OrbChart at runtime (covers: AC-3)", () => {
    expect(Object.keys(react).sort()).toEqual(["OrbChart"]);
  });

  it("importing both entries touches no DOM globals (covers: AC-5)", () => {
    expect(typeof window).toBe("undefined");
    expect(typeof document).toBe("undefined");
  });
});
