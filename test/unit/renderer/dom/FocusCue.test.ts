/**
 * @jest-environment jsdom
 */
import { FocusCue } from "@/renderer/dom/FocusCue";
import { TooltipView } from "@/renderer/dom/TooltipView";
import type { Orb } from "@/types/types";

const makeOrb = (id: string, radius = 20): Orb => ({
  id,
  label: id.toUpperCase(),
  value: 3,
  radius,
  x: 100,
  y: 80,
  vx: 0,
  vy: 0,
});

describe("FocusCue (AC-5)", () => {
  let container: HTMLDivElement;
  let tooltip: TooltipView;
  let setRing: jest.Mock;
  let redraw: jest.Mock;
  let cue: FocusCue;
  const el = () => container.querySelector("div") as HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    tooltip = new TooltipView(container, () => ({ width: 400, height: 300 }));
    tooltip.setEnabled(true);
    setRing = jest.fn();
    redraw = jest.fn();
    cue = new FocusCue({
      tooltip,
      setRing,
      centerOf: (orb) => ({ x: orb.x, y: orb.y + 1.5 }),
      redraw,
    });
  });

  it("rings the orb, places the tooltip beside it, and redraws", () => {
    cue.focus(makeOrb("a", 20));

    expect(setRing).toHaveBeenCalledWith("a");
    expect(el().style.left).toBe(`${100 + 22}px`);
    expect(el().style.top).toBe(`${81.5 + 22}px`);
    expect(el().style.opacity).toBe("1");
    expect(redraw).toHaveBeenCalledTimes(1);
  });

  it("removes the ring and hides the tooltip when focus leaves", () => {
    cue.focus(makeOrb("a"));
    cue.focus(null);

    expect(setRing).toHaveBeenLastCalledWith(null);
    expect(el().style.opacity).toBe("0");
    expect(redraw).toHaveBeenCalledTimes(2);
  });

  it("keeps the ring but shows no tooltip when tooltips are off", () => {
    tooltip.setEnabled(false);
    expect(() => cue.focus(makeOrb("a"))).not.toThrow();
    expect(setRing).toHaveBeenCalledWith("a");
    expect(container.children).toHaveLength(0);
  });

  it("escape hides a focus tooltip and says so", () => {
    cue.focus(makeOrb("a"));
    expect(cue.escape()).toBe(true);
    expect(el().style.opacity).toBe("0");
    expect(cue.escape()).toBe(false);
  });

  it("escape does nothing when the pointer owns the tooltip or nothing has focus", () => {
    expect(cue.escape()).toBe(false);
    cue.focus(makeOrb("a"));
    tooltip.show(makeOrb("b"), 1, 1, false, "pointer");
    expect(cue.escape()).toBe(false);
    expect(el().style.opacity).toBe("1");
  });

  it("stays dismissed on the same orb, and shows again on another", () => {
    cue.focus(makeOrb("a"));
    cue.escape();

    const a = makeOrb("a");
    cue.focus(a);
    expect(el().style.opacity).toBe("0");

    cue.focus(makeOrb("b"));
    expect(el().style.opacity).toBe("1");
    expect(el().textContent).toContain("B");
  });

  it("refills only a tooltip that focus owns", () => {
    const orb = makeOrb("a");
    cue.focus(orb);
    orb.value = 9;
    cue.refresh();
    expect(el().textContent).toContain("Value: 9");

    cue.focus(null);
    orb.value = 1;
    cue.refresh();
    expect(el().textContent).toContain("Value: 9");
  });
});
