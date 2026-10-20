/**
 * @jest-environment jsdom
 */
import { LabelFitter } from "./LabelFitter";
import {
  FAKE_CHAR_WIDTH,
  defined,
  installFakeCanvas,
  type FakeContext,
} from "../test-support/fakeDom";

describe("LabelFitter (AC-4)", () => {
  let ctx: CanvasRenderingContext2D;
  let fake: FakeContext;

  beforeEach(() => {
    const contexts = installFakeCanvas();
    ctx = defined(document.createElement("canvas").getContext("2d"));
    fake = contexts[0];
  });

  afterEach(() => jest.restoreAllMocks());

  const width = (text: string, size: number) =>
    text.length * size * FAKE_CHAR_WIDTH;
  const font = "Inter, system-ui, sans-serif";

  it("uses 0.4r for a short label and centers the pair", () => {
    const fit = new LabelFitter().fit(ctx, font, 60, "A", "5%", false);
    expect(fit?.labelSize).toBeCloseTo(24);
    expect(fit?.valueSize).toBeCloseTo(0.62 * 24);
    expect(fit?.labelDy).toBeCloseTo(-0.5 * defined(fit).valueSize);
    expect(fit?.valueDy).toBeCloseTo(0.55 * 24);
  });

  it("shrinks a long label so it is never wider than 1.5r", () => {
    const fit = new LabelFitter().fit(
      ctx,
      font,
      80,
      "Ethereum Classic",
      null,
      false,
    );
    expect(width("Ethereum Classic", defined(fit).labelSize)).toBeCloseTo(120);
    expect(defined(fit).labelSize).toBeLessThan(0.4 * 80);
  });

  it("hides the label, and so the value, when it would be under 10 px", () => {
    expect(
      new LabelFitter().fit(ctx, font, 20, "A long label", "1%", false),
    ).toBeNull();
    expect(new LabelFitter().fit(ctx, font, 24, "A", "1%", false)).toBeNull();
  });

  it("hides the value under 30 px of radius", () => {
    const fit = new LabelFitter().fit(ctx, font, 29, "AB", "10%", false);
    expect(fit?.valueSize).toBe(0);
    expect(fit?.labelDy).toBe(0);
  });

  it("hides the value when it would be under 10 px", () => {
    const fit = new LabelFitter().fit(ctx, font, 30, "AB", "12345678%", false);
    expect(fit?.labelSize).toBeGreaterThanOrEqual(10);
    expect(fit?.valueSize).toBe(0);
  });

  it("puts the label low and narrower over an image, with no value", () => {
    const fit = new LabelFitter().fit(ctx, font, 50, "Solana", "9%", true);
    expect(fit?.labelDy).toBeCloseTo(22.5);
    expect(fit?.valueSize).toBe(0);
    expect(width("Solana", defined(fit).labelSize)).toBeLessThanOrEqual(
      60 + 1e-9,
    );
  });

  it("measures each text once per font, and again after the font changes", () => {
    const fitter = new LabelFitter();
    const measures = () => fake.font;
    const spy = jest.spyOn(
      fake as unknown as { measureText: () => unknown },
      "measureText",
    );
    fitter.fit(ctx, font, 60, "A", "5%", false);
    fitter.fit(ctx, font, 70, "A", "5%", false);
    expect(spy).toHaveBeenCalledTimes(2);
    fitter.fit(ctx, "Nunito", 60, "A", "5%", false);
    expect(spy).toHaveBeenCalledTimes(4);
    expect(measures()).toContain("Nunito");
  });
});
