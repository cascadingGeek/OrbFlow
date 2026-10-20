/**
 * @jest-environment jsdom
 */
import { resolveContainer } from "./resolveContainer";

describe("resolveContainer", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("returns an element as it is", () => {
    const el = document.createElement("div");
    expect(resolveContainer(el)).toBe(el);
  });

  it("finds an element by CSS selector", () => {
    document.body.innerHTML = '<div id="chart"></div>';
    expect(resolveContainer("#chart")).toBe(document.getElementById("chart"));
  });

  it("throws a clear error when the selector matches nothing", () => {
    expect(() => resolveContainer("#missing")).toThrow(
      'Container "#missing" not found',
    );
  });
});
