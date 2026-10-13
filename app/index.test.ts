/**
 * Source level checks of the public surface (spec 0001). Runs in plain Node
 * with no DOM. The built package is checked separately by `check:package`
 * and `smoke`, which read dist/ and the packed tarball.
 */
describe("public entries", () => {
  it("core entry exports exactly OrbChart at runtime (covers: AC-3)", async () => {
    const core = await import("./index");

    expect(Object.keys(core).sort()).toEqual(["OrbChart"]);
  });

  it("React entry exports exactly OrbChart at runtime (covers: AC-3)", async () => {
    const react = await import("./react/index");

    expect(Object.keys(react).sort()).toEqual(["OrbChart"]);
  });

  it("importing both entries touches no DOM globals (covers: AC-5)", async () => {
    await import("./index");
    await import("./react/index");

    expect(typeof window).toBe("undefined");
    expect(typeof document).toBe("undefined");
  });
});
