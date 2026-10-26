/**
 * @jest-environment jsdom
 */
import { TooltipView } from "../../../../app/renderer/dom/TooltipView";
import type { Orb } from "../../../../app/types/types";

const makeOrb = (over: Partial<Orb> = {}): Orb => ({
  id: "a",
  label: "Alpha",
  value: 5,
  radius: 20,
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  ...over,
});

describe("TooltipView", () => {
  let container: HTMLDivElement;
  let view: TooltipView;
  const el = () => container.querySelector("div") as HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    view = new TooltipView(container, () => ({ width: 400, height: 300 }));
    view.setEnabled(true);
  });

  it("is hidden from assistive technology", () => {
    expect(el().getAttribute("aria-hidden")).toBe("true");
  });

  it("shows text, never HTML, and places it", () => {
    view.show(
      makeOrb({ label: "<i>x</i>", metadata: { category: "Fruit" } }),
      30,
      40,
      false,
      "pointer",
    );
    expect(el().querySelector("i")).toBeNull();
    expect(el().textContent).toBe("<i>x</i>Value: 5Fruit");
    expect(el().style.left).toBe("30px");
    expect(el().style.top).toBe("40px");
    expect(el().style.opacity).toBe("1");
  });

  it("keeps a tooltip for a bubble below the canvas inside the chart (spec 0006 AC-5)", () => {
    jest.spyOn(el(), "getBoundingClientRect").mockReturnValue({
      width: 100,
      height: 40,
    } as DOMRect);

    view.show(makeOrb(), 500, 900, false, "focus");

    expect(parseFloat(el().style.left)).toBeLessThanOrEqual(300);
    expect(parseFloat(el().style.left)).toBeGreaterThanOrEqual(0);
    expect(parseFloat(el().style.top)).toBeLessThanOrEqual(260);
    expect(parseFloat(el().style.top)).toBeGreaterThanOrEqual(0);
  });

  it("never places a tooltip at a negative position", () => {
    view.show(makeOrb(), -50, -50, false, "focus");

    expect(el().style.left).toBe("0px");
    expect(el().style.top).toBe("0px");
  });

  it("lets only the owner hide it", () => {
    view.show(makeOrb(), 1, 1, false, "focus");
    expect(view.owner).toBe("focus");
    view.hide("pointer");
    expect(el().style.opacity).toBe("1");
    view.hide("focus");
    expect(el().style.opacity).toBe("0");
    expect(view.owner).toBeNull();
  });

  it("gives the last event to show it the ownership", () => {
    view.show(makeOrb(), 1, 1, false, "pointer");
    view.show(makeOrb({ label: "Beta" }), 1, 1, false, "focus");
    expect(view.owner).toBe("focus");
    view.hide("pointer");
    expect(el().textContent).toContain("Beta");
    expect(el().style.opacity).toBe("1");
  });

  it("refills only when the text changed", () => {
    const orb = makeOrb();
    view.show(orb, 1, 1, false, "pointer");
    const child = el().firstChild;
    view.refill(orb);
    expect(el().firstChild).toBe(child);
    orb.value = 9;
    view.refill(orb);
    expect(el().textContent).toContain("Value: 9");
  });

  it("switches the fade on and off in place", () => {
    expect(el().style.transition).toBe("opacity 0.2s");
    view.setFade(false);
    expect(el().style.transition).toBe("none");
    view.setFade(true);
    expect(el().style.transition).toBe("opacity 0.2s");
  });

  it("does nothing while disabled, and removes the element", () => {
    view.setEnabled(false);
    expect(container.children).toHaveLength(0);
    view.show(makeOrb(), 1, 1, false, "pointer");
    expect(view.owner).toBeNull();
  });

  it("does not touch the container's position", () => {
    expect(container.style.position).toBe("");
  });
});
