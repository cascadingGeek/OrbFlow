import { ValueFormatter } from "../../../app/renderer/ValueFormatter";
import type { Orb, OrbChartConfig } from "../../../app/types/types";

const orb = (value: number, id = "a"): Orb => ({
  id,
  label: id,
  value,
  radius: 40,
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
});

describe("ValueFormatter (spec 0007 AC-1, AC-2, AC-3)", () => {
  let config: Pick<OrbChartConfig, "formatValue">;
  let error: jest.SpyInstance;
  const make = () => new ValueFormatter(() => config);

  beforeEach(() => {
    config = {};
    error = jest.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it("uses the plain number, with no rounding and no percent sign", () => {
    expect(make().text(orb(42))).toBe("42");
    expect(make().text(orb(0.1 + 0.2))).toBe("0.30000000000000004");
  });

  it("passes the value and the developer's own orb", () => {
    const formatValue = jest.fn(() => "x");
    config = { formatValue };
    const o = orb(7);
    make().text(o);
    expect(formatValue).toHaveBeenCalledWith(7, o);
  });

  it("converts a result that is not a string", () => {
    config = { formatValue: (() => 5) as never };
    expect(make().text(orb(1))).toBe("5");
  });

  it("returns an empty string for an empty or whitespace result", () => {
    config = { formatValue: () => "  \n" };
    expect(make().text(orb(1))).toBe("");
  });

  it("falls back to the plain number on a throw and logs only once per chart", () => {
    config = {
      formatValue: () => {
        throw new Error("boom");
      },
    };
    const values = make();
    expect(values.text(orb(3))).toBe("3");
    expect(values.text(orb(4))).toBe("4");
    config = {
      formatValue: () => {
        throw new Error("again");
      },
    };
    expect(values.text(orb(5))).toBe("5");
    expect(error).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(
      "OrbFlow: formatValue handler threw.",
      expect.any(Error),
    );
  });

  it("serves the drawn text without calling the formatter again", () => {
    const formatValue = jest.fn((v: number) => `$${v}`);
    config = { formatValue };
    const values = make();
    const o = orb(9);
    values.text(o);
    expect(values.drawnText(o)).toBe("$9");
    expect(formatValue).toHaveBeenCalledTimes(1);
  });

  it("makes a fresh text for an orb never drawn, or whose value changed", () => {
    config = { formatValue: (v) => `$${v}` };
    const values = make();
    const o = orb(9);
    expect(values.drawnText(o)).toBe("$9");
    values.text(o);
    o.value = 10;
    expect(values.drawnText(o)).toBe("$10");
  });

  it("forgets the drawn texts when a new frame begins", () => {
    let suffix = "a";
    config = { formatValue: (v) => `${v}${suffix}` };
    const values = make();
    const o = orb(1);
    values.text(o);
    suffix = "b";
    expect(values.drawnText(o)).toBe("1a");
    values.beginFrame();
    expect(values.drawnText(o)).toBe("1b");
  });

  it("makes one fresh text for an orb not drawn yet, and keeps it (AC-12)", () => {
    const formatValue = jest.fn((v: number) => `$${v}`);
    config = { formatValue };
    const values = make();
    const o = orb(5);

    expect(values.drawnText(o)).toBe("$5");
    expect(values.drawnText(o)).toBe("$5");
    expect(formatValue).toHaveBeenCalledTimes(1);
  });

  it("makes a fresh text once when the value or the label changed", () => {
    const formatValue = jest.fn((v: number, o: Orb) => `${o.label}:${v}`);
    config = { formatValue };
    const values = make();
    const o = orb(1);
    values.text(o);
    formatValue.mockClear();

    expect(values.drawnText({ ...o, value: 2 })).toBe("a:2");
    expect(values.drawnText({ ...o, value: 2 })).toBe("a:2");
    expect(values.drawnText({ ...o, value: 2, label: "b" })).toBe("b:2");
    expect(formatValue).toHaveBeenCalledTimes(2);
  });
});
