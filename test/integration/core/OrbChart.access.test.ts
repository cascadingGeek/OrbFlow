/**
 * @jest-environment jsdom
 */
import { OrbChart } from "@/core/OrbChart";
import {
  defined,
  dispatchMouse,
  installFakeCanvas,
  installFakeResizeObserver,
  installFrameQueue,
  pressKey,
  setElementSize,
  trackListeners,
  type FakeContext,
} from "@test/support/fakeDom";
import type { OrbChartConfig, OrbDataInput } from "@/types/types";

const row = (id: string, value: number, extra = {}): OrbDataInput => ({
  id,
  label: id.toUpperCase(),
  value,
  ...extra,
});

describe("OrbChart accessible layer", () => {
  let container: HTMLDivElement;
  let frames: ReturnType<typeof installFrameQueue>;
  let listeners: ReturnType<typeof trackListeners>;
  let contexts: FakeContext[];
  let charts: OrbChart[];

  beforeEach(() => {
    contexts = installFakeCanvas();
    installFakeResizeObserver();
    frames = installFrameQueue();
    jest.spyOn(performance, "now").mockReturnValue(0);
    jest.spyOn(Math, "random").mockReturnValue(0.5);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    container = document.createElement("div");
    setElementSize(container, 400, 300);
    document.body.appendChild(container);
    listeners = trackListeners();
    charts = [];
  });

  afterEach(() => {
    charts.forEach((chart) => chart.destroy());
    container.remove();
    jest.restoreAllMocks();
  });

  const make = (config: OrbChartConfig = {}, data = [row("a", 1)]) => {
    const chart = new OrbChart(container, { transitionDuration: 0, ...config });
    charts.push(chart);
    chart.setData(data);
    return chart;
  };
  const list = () => container.querySelector("ul") as HTMLUListElement;
  const buttons = () =>
    [...container.querySelectorAll("button")] as HTMLButtonElement[];
  const texts = () => buttons().map((b) => b.textContent);
  const tooltip = () =>
    container.querySelector(":scope > div[aria-hidden]") as HTMLDivElement;
  const arcRadii = () => {
    const calls = contexts.flatMap((c) => c.calls);
    const lastClear = calls.map((c) => c.method).lastIndexOf("fillRect");
    return calls
      .slice(lastClear)
      .filter((c) => c.method === "arc")
      .map((c) => c.args[2] as number);
  };

  describe("name and description (AC-1)", () => {
    it("hides the canvas and tooltip, and names the list", () => {
      make();
      expect(
        container.querySelector("canvas")?.getAttribute("aria-hidden"),
      ).toBe("true");
      expect(tooltip().getAttribute("aria-hidden")).toBe("true");
      expect(list().getAttribute("role")).toBe("list");
      expect(list().getAttribute("tabindex")).toBe("-1");
      expect(list().getAttribute("aria-label")).toBe("Bubble chart");
      expect(list().hasAttribute("aria-describedby")).toBe(false);
      expect(container.querySelector("span")).toBeNull();
    });

    it("uses ariaLabel, and treats blank as unset", () => {
      make({ ariaLabel: "Sales by region" });
      expect(list().getAttribute("aria-label")).toBe("Sales by region");
      charts[0].updateConfig({ ariaLabel: "   " });
      expect(list().getAttribute("aria-label")).toBe("Bubble chart");
    });

    it("adds, updates, and clears the description in place", () => {
      const chart = make({ ariaDescription: "Revenue" });
      const before = list();
      const span = container.querySelector("span") as HTMLSpanElement;
      expect(span.textContent).toBe("Revenue");
      expect(list().getAttribute("aria-describedby")).toBe(span.id);

      chart.updateConfig({ ariaDescription: "Cost", ariaLabel: "Costs" });
      expect(container.querySelector("span")).toBe(span);
      expect(span.textContent).toBe("Cost");
      expect(list()).toBe(before);
      expect(list().getAttribute("aria-label")).toBe("Costs");

      chart.updateConfig({ ariaDescription: undefined });
      expect(span.isConnected).toBe(true);
      chart.updateConfig({ ariaDescription: "" });
      expect(container.querySelector("span")).toBeNull();
      expect(list().hasAttribute("aria-describedby")).toBe(false);
    });
  });

  describe("one button per orb (AC-2)", () => {
    it("writes label, value, and category as text in input order", () => {
      make({}, [
        row("a", 3, { metadata: { category: "Fruit" } }),
        row("b", 1, { label: "" }),
        row("c", 2, { label: "<b>bold</b>" }),
      ]);
      expect(texts()).toEqual([
        "A, value 3, category Fruit",
        "b, value 1",
        "<b>bold</b>, value 2",
      ]);
      expect(container.querySelector("b")).toBeNull();
      expect(buttons().every((b) => b.type === "button")).toBe(true);
      expect(container.querySelectorAll("li")).toHaveLength(3);
    });

    it("keeps the same button when an id stays, and drops removed ones at once", () => {
      const chart = new OrbChart(container); // default transition: orbs shrink out
      charts.push(chart);
      chart.setData([row("a", 1), row("b", 2)]);
      const [a, b] = buttons();

      chart.setData([row("a", 9)]);

      expect(buttons()).toEqual([a]);
      expect(a.textContent).toBe("A, value 9");
      expect(b.isConnected).toBe(false);
      expect(chart.getData()).toHaveLength(1);
    });

    it("has no buttons for an empty chart", () => {
      make({}, []);
      expect(buttons()).toHaveLength(0);
    });

    it("follows a reorder and keeps focus on the focused button", () => {
      const chart = make({}, [row("a", 1), row("b", 2), row("c", 3)]);
      const b = buttons()[1];
      b.focus();

      chart.setData([row("c", 3), row("b", 2), row("a", 1)]);

      expect(texts()).toEqual(["C, value 3", "B, value 2", "A, value 1"]);
      expect(document.activeElement).toBe(b);
    });
  });

  describe("roving keyboard (AC-3)", () => {
    const stops = () => buttons().map((b) => b.getAttribute("tabindex"));

    it("has exactly one tab stop, which follows focus", () => {
      make({}, [row("a", 1), row("b", 2), row("c", 3)]);
      expect(stops()).toEqual(["0", "-1", "-1"]);
      buttons()[2].focus();
      expect(stops()).toEqual(["-1", "-1", "0"]);
      buttons()[2].blur();
      expect(stops()).toEqual(["-1", "-1", "0"]);
    });

    it("moves with arrows, Home, and End, with no wrap", () => {
      make({}, [row("a", 1), row("b", 2), row("c", 3)]);
      const move = (key: string) => {
        const event = pressKey(defined(document.activeElement), key);
        return event.defaultPrevented;
      };
      buttons()[0].focus();
      expect(move("ArrowLeft")).toBe(true);
      expect(document.activeElement).toBe(buttons()[0]);
      expect(move("ArrowRight")).toBe(true);
      expect(document.activeElement).toBe(buttons()[1]);
      move("ArrowDown");
      expect(document.activeElement).toBe(buttons()[2]);
      move("ArrowDown");
      expect(document.activeElement).toBe(buttons()[2]);
      move("ArrowUp");
      expect(document.activeElement).toBe(buttons()[1]);
      move("End");
      expect(document.activeElement).toBe(buttons()[2]);
      move("Home");
      expect(document.activeElement).toBe(buttons()[0]);
    });

    it("leaves other keys and modified keys alone", () => {
      make({}, [row("a", 1), row("b", 2)]);
      buttons()[0].focus();
      expect(pressKey(buttons()[0], "x").defaultPrevented).toBe(false);
      expect(pressKey(buttons()[0], "Tab").defaultPrevented).toBe(false);
      const ctrl = pressKey(buttons()[0], "ArrowRight", { ctrlKey: true });
      expect(ctrl.defaultPrevented).toBe(false);
      expect(
        pressKey(buttons()[0], "ArrowRight", { altKey: true }),
      ).toBeTruthy();
      expect(document.activeElement).toBe(buttons()[0]);
    });
  });

  describe("activation (AC-4)", () => {
    it("calls onOrbClick once with the live orb and the click event", () => {
      const onOrbClick = jest.fn();
      const onOrbHover = jest.fn();
      const chart = make({ onOrbClick, onOrbHover }, [
        row("a", 1),
        row("b", 2),
      ]);
      const [orb] = chart.getData();
      const before = { vx: orb.vx, vy: orb.vy };

      buttons()[0].click();

      expect(onOrbClick).toHaveBeenCalledTimes(1);
      const [got, event] = onOrbClick.mock.calls[0];
      expect(got).toBe(orb);
      expect(event).toBeInstanceOf(MouseEvent);
      expect(onOrbHover).not.toHaveBeenCalled();
      expect({ vx: orb.vx, vy: orb.vy }).toEqual(before);
    });

    it("uses the newest onOrbClick after updateConfig", () => {
      const first = jest.fn();
      const second = jest.fn();
      const chart = make({ onOrbClick: first });
      chart.updateConfig({ onOrbClick: second });
      buttons()[0].click();
      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledTimes(1);
    });
  });

  describe("focus cue (AC-5)", () => {
    const hovered = jest.fn();
    beforeEach(() => hovered.mockClear());

    it("draws a two tone ring on top and removes it on blur", () => {
      const chart = make({ onOrbHover: hovered });
      chart.pause();
      const [orb] = chart.getData();
      expect(arcRadii()).not.toContain(orb.radius + 5);

      buttons()[0].focus();
      const radii = arcRadii();
      expect(radii.slice(-2)).toEqual([orb.radius + 3, orb.radius + 5]);

      buttons()[0].blur();
      expect(arcRadii()).not.toContain(orb.radius + 5);
      expect(hovered).not.toHaveBeenCalled();
    });

    it("redraws a stopped chart once per focus change", () => {
      const chart = make();
      chart.pause();
      const draws = () =>
        contexts.flatMap((c) => c.calls).filter((c) => c.method === "fillRect")
          .length;
      const before = draws();
      buttons()[0].focus();
      expect(draws()).toBe(before + 1);
      expect(frames.pending()).toBe(0);
    });

    it("shows the tooltip beside the orb on focus, and hides it on blur", () => {
      const chart = make();
      chart.pause();
      const [orb] = chart.getData();
      buttons()[0].focus();

      expect(tooltip().style.opacity).toBe("1");
      const offset = orb.radius * 0.7 + 8;
      expect(tooltip().style.left).toBe(`${orb.x + offset}px`);
      expect(tooltip().style.top).toBe(`${orb.y + offset}px`);
      expect(tooltip().textContent).toContain("A");

      buttons()[0].blur();
      expect(tooltip().style.opacity).toBe("0");
    });

    it("lets only the owner hide it, so a pointer leave keeps a focus tooltip", () => {
      make();
      const canvas = defined(container.querySelector("canvas"));
      buttons()[0].focus();
      dispatchMouse(canvas, "pointermove", 0, 0);
      expect(tooltip().style.opacity).toBe("1");
      dispatchMouse(canvas, "pointerleave");
      expect(tooltip().style.opacity).toBe("1");
    });

    it("shows no tooltip when enableTooltip is false, but still draws the ring", () => {
      const chart = make({ enableTooltip: false });
      chart.pause();
      buttons()[0].focus();
      expect(container.querySelector(":scope > div[aria-hidden]")).toBeNull();
      expect(arcRadii().length).toBeGreaterThan(2);
    });

    it("hides on Escape only when it hid something, until focus moves on", () => {
      make({}, [row("a", 1), row("b", 2)]);
      expect(pressKey(list(), "Escape").defaultPrevented).toBe(false);

      buttons()[0].focus();
      const escape = pressKey(buttons()[0], "Escape");
      expect(escape.defaultPrevented).toBe(true);
      expect(tooltip().style.opacity).toBe("0");
      expect(pressKey(buttons()[0], "Escape").defaultPrevented).toBe(false);

      pressKey(buttons()[0], "ArrowRight");
      expect(tooltip().style.opacity).toBe("1");
      expect(tooltip().textContent).toContain("B");
    });

    it("refills the tooltip when setData changes the focused orb's text", () => {
      const chart = make();
      buttons()[0].focus();
      chart.setData([row("a", 7)]);
      expect(tooltip().textContent).toContain("7");
    });
  });

  describe("lost focus (AC-6)", () => {
    const three = () => [row("a", 1), row("b", 2), row("c", 3)];

    it("moves to the next surviving orb", () => {
      const chart = make({}, three());
      buttons()[1].focus();
      chart.setData([row("a", 1), row("c", 3)]);
      expect(document.activeElement).toBe(buttons()[1]);
      expect(buttons()[1].textContent).toBe("C, value 3");
    });

    it("moves to the previous one when the last is removed", () => {
      const chart = make({}, three());
      buttons()[2].focus();
      chart.setData([row("a", 1), row("b", 2)]);
      expect(document.activeElement).toBe(buttons()[1]);
    });

    it("moves to the list when nothing is left", () => {
      const chart = make({}, three());
      buttons()[0].focus();
      chart.setData([]);
      expect(document.activeElement).toBe(list());
    });

    it("does not steal focus from elsewhere on the page", () => {
      const outside = document.createElement("input");
      document.body.appendChild(outside);
      const chart = make({}, three());
      outside.focus();
      chart.setData([row("a", 1)]);
      expect(document.activeElement).toBe(outside);
      outside.remove();
    });

    it("makes the new button the tab stop", () => {
      const chart = make({}, three());
      buttons()[1].focus();
      chart.setData([row("a", 1), row("c", 3)]);
      expect(buttons().map((b) => b.tabIndex)).toEqual([-1, 0]);
    });
  });

  describe("teardown (AC-11)", () => {
    it("removes the list, description, listeners, and position style", () => {
      container.style.position = "";
      const chart = make({ ariaDescription: "About" });
      expect(container.style.position).toBe("relative");
      buttons()[0].focus();

      chart.destroy();
      chart.destroy();

      expect(container.children).toHaveLength(0);
      expect(container.style.position).toBe("");
      expect(
        listeners.count(
          (t) => t === container || t instanceof HTMLElement || t === document,
        ),
      ).toBe(0);
      expect(frames.pending()).toBe(0);
    });

    it("keeps a position the page set itself", () => {
      container.style.position = "absolute";
      const chart = make();
      chart.destroy();
      expect(container.style.position).toBe("absolute");
    });
  });
});
