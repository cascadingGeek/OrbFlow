/**
 * @jest-environment jsdom
 */
import { OrbChart } from "../../../app/core/OrbChart";
import {
  installFakeCanvas,
  installFakeResizeObserver,
  installFrameQueue,
  setElementSize,
  type FakeContext,
} from "../../support/fakeDom";
import type { OrbChartConfig, OrbDataInput } from "../../../app/types/types";

const row = (id: string, value: number): OrbDataInput => ({
  id,
  label: id.toUpperCase(),
  value,
});

describe("OrbChart formatValue and minTextSize (spec 0007)", () => {
  let container: HTMLDivElement;
  let frames: ReturnType<typeof installFrameQueue>;
  let contexts: FakeContext[];
  let charts: OrbChart[];
  let error: jest.SpyInstance;

  beforeEach(() => {
    contexts = installFakeCanvas();
    installFakeResizeObserver();
    frames = installFrameQueue();
    jest.spyOn(performance, "now").mockReturnValue(0);
    jest.spyOn(Math, "random").mockReturnValue(0.5);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    container = document.createElement("div");
    setElementSize(container, 400, 300);
    document.body.appendChild(container);
    charts = [];
  });

  afterEach(() => {
    charts.forEach((chart) => chart.destroy());
    container.remove();
    jest.restoreAllMocks();
  });

  const make = (config: OrbChartConfig = {}, data = [row("a", 42)]) => {
    const chart = new OrbChart(container, { transitionDuration: 0, ...config });
    charts.push(chart);
    chart.setData(data);
    return chart;
  };
  const buttons = () =>
    [...container.querySelectorAll("button")] as HTMLButtonElement[];
  const tooltip = () =>
    container.querySelector(":scope > div[aria-hidden]") as HTMLDivElement;
  const lastFrameTexts = () => {
    const calls = contexts.flatMap((c) => c.calls);
    const at = calls.map((c) => c.method).lastIndexOf("fillRect");
    return calls
      .slice(at)
      .filter((c) => c.method === "fillText")
      .map((c) => c.args[0]);
  };

  it("shows the plain number on the canvas, in the tooltip, and in the hidden text", () => {
    make();
    frames.step();
    expect(lastFrameTexts()).toContain("42");
    expect(lastFrameTexts()).not.toContain("42%");
    buttons()[0].focus();
    expect(tooltip().textContent).toContain("Value: 42");
    expect(buttons()[0].textContent).toBe("A, value 42");
  });

  it("shows one formatted text on all three surfaces (AC-2)", () => {
    make({ formatValue: (v) => `$${v}` });
    frames.step();
    expect(lastFrameTexts()).toContain("$42");
    buttons()[0].focus();
    expect(tooltip().textContent).toContain("Value: $42");
    expect(buttons()[0].textContent).toBe("A, value $42");
  });

  it("calls the formatter once per bubble per frame (AC-12)", () => {
    const formatValue = jest.fn((v: number) => `$${v}`);
    make({ formatValue });
    frames.step();
    buttons()[0].focus();
    formatValue.mockClear();
    frames.step();
    expect(formatValue).toHaveBeenCalledTimes(1);
  });

  it("shares one between frame text across the list and the tooltip after a setData (AC-12)", () => {
    const formatValue = jest.fn((v: number) => `$${v}`);
    const chart = make({ formatValue });
    frames.step();
    buttons()[0].focus();
    chart.pause();
    formatValue.mockClear();
    chart.setData([row("a", 43)]);
    // One call for the list and tooltip together, one for the repaint.
    expect(formatValue).toHaveBeenCalledTimes(2);
    expect(buttons()[0].textContent).toBe("A, value $43");
    expect(tooltip().textContent).toContain("Value: $43");
  });

  it("writes nothing to the buttons or the tooltip on a settled frame (AC-5)", () => {
    make({ formatValue: (v) => `$${v}` });
    frames.step();
    buttons()[0].focus();
    frames.step();
    const watcher = new MutationObserver(() => undefined);
    watcher.observe(container, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
    });
    frames.step();
    frames.step();
    frames.step();
    const writes = watcher
      .takeRecords()
      .filter((r) => r.target !== container.querySelector("canvas"));
    watcher.disconnect();
    expect(writes.map((r) => `${r.type} on ${r.target.nodeName}`)).toEqual([]);
  });

  it("keeps drawing when the formatter throws, and logs once (AC-3)", () => {
    make({
      formatValue: () => {
        throw new Error("boom");
      },
    });
    frames.step(3);
    expect(lastFrameTexts()).toContain("42");
    expect(error).toHaveBeenCalledTimes(1);
  });

  it("drops the value everywhere for a whitespace result (AC-3)", () => {
    make({ formatValue: () => "  " });
    frames.step();
    expect(lastFrameTexts()).toEqual(["A"]);
    buttons()[0].focus();
    expect(tooltip().textContent).not.toContain("Value");
    expect(buttons()[0].textContent).toBe("A");
  });

  it("updates a paused chart once, with no queued frame, keeping focus (AC-5)", () => {
    const chart = make();
    frames.step();
    chart.pause();
    const button = buttons()[0];
    button.focus();
    chart.updateConfig({ formatValue: (v) => `${v} ms` });
    expect(frames.pending()).toBe(0);
    expect(lastFrameTexts()).toContain("42 ms");
    expect(buttons()[0]).toBe(button);
    expect(document.activeElement).toBe(button);
    expect(button.textContent).toBe("A, value 42 ms");
    expect(tooltip().textContent).toContain("Value: 42 ms");
  });

  it("returns to the plain number with formatValue: String (AC-1)", () => {
    const chart = make({ formatValue: (v) => `$${v}` });
    chart.pause();
    chart.updateConfig({ formatValue: String });
    expect(lastFrameTexts()).toContain("42");
    expect(buttons()[0].textContent).toBe("A, value 42");
  });

  it("follows a formatter that reads outside data on the next draw (AC-5)", () => {
    let unit = "ms";
    const chart = make({ formatValue: (v) => `${v} ${unit}` });
    chart.pause();
    unit = "s";
    chart.setData([row("a", 42)]);
    expect(buttons()[0].textContent).toBe("A, value 42 s");
  });

  it("shows the text at pop time on the ghost, and the current text after a restore (AC-4)", () => {
    let prefix = "$";
    const chart = make({
      popStyle: "ghost",
      formatValue: (v) => `${prefix}${v}`,
    });
    chart.pause();
    chart.pop("a");
    prefix = "€";
    chart.updateConfig({ formatValue: (v) => `${prefix}${v}` });
    expect(lastFrameTexts()).toContain("$42");
    expect(lastFrameTexts()).not.toContain("€42");
    chart.restore("a");
    frames.step();
    expect(lastFrameTexts()).toContain("€42");
    expect(buttons()[0].textContent).toBe("A, value €42");
  });

  it("shows text under 10 px once minTextSize is lowered (AC-8, AC-9)", () => {
    const chart = make({ maxRadius: 20 }, [row("a", 1)]);
    chart.pause();
    chart.updateConfig({ maxRadius: 20 });
    expect(lastFrameTexts()).toEqual([]);
    chart.updateConfig({ minTextSize: 6 });
    expect(lastFrameTexts()).toContain("A");
    chart.updateConfig({ minTextSize: 12 });
    expect(lastFrameTexts()).toEqual([]);
  });

  it("warns once for a bad minTextSize and uses 10", () => {
    const warn = jest.spyOn(console, "warn");
    const chart = make({ minTextSize: 0 });
    chart.updateConfig({ minTextSize: 0 });
    expect(
      warn.mock.calls.filter((c) => String(c[0]).includes("minTextSize")),
    ).toHaveLength(1);
  });
});
