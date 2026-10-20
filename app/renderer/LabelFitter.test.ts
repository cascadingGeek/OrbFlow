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

  it("measures nothing new for a size it has seen, until the font changes", () => {
    const fitter = new LabelFitter();
    const spy = jest.spyOn(
      fake as unknown as { measureText: () => unknown },
      "measureText",
    );
    fitter.fit(ctx, font, 60, "A", "5%", false);
    const first = spy.mock.calls.length;

    fitter.fit(ctx, font, 60, "A", "5%", false);
    expect(spy).toHaveBeenCalledTimes(first);

    fitter.fit(ctx, "Nunito", 60, "A", "5%", false);
    expect(spy.mock.calls.length).toBeGreaterThan(first);
    expect(fake.font).toContain("Nunito");
  });

  describe("with a font that is wider per em at small sizes, like macOS system-ui", () => {
    // Fitted to Chrome's real "Bitcoin Cash" widths with SF Pro (bold):
    // 571.7 px at 100 px, about 587 per 100 at 32 px, 643.9 per 100 at 10 px.
    const perEm = (size: number) => 5.637 + 8.02 / size;
    const sfWidth = (text: string, size: number) =>
      (text.length / 12) * size * perEm(size);

    beforeEach(() => {
      fake.measureText = (text: string) => {
        const size = Number(/(\d+(?:\.\d+)?)px/.exec(fake.font)?.[1]);
        return { width: sfWidth(text, size) };
      };
    });

    it.each([80, 60, 50])(
      "fits a long label to exactly 1.5r at radius %i, never wider",
      (r) => {
        const fit = defined(
          new LabelFitter().fit(ctx, font, r, "Bitcoin Cash", null, false),
        );
        const drawn = sfWidth("Bitcoin Cash", fit.labelSize);
        expect(drawn).toBeLessThanOrEqual(1.5 * r);
        expect(drawn).toBeGreaterThan(1.5 * r * 0.995);
      },
    );

    it("hides a label that only reaches 1.5r below 10 px", () => {
      // 64.4 px wide at 10 px, so it cannot fit 60 px at a readable size.
      expect(
        new LabelFitter().fit(ctx, font, 40, "Bitcoin Cash", null, false),
      ).toBeNull();
    });

    it("fits the value line under its own 1.5r cap too", () => {
      const fit = defined(
        new LabelFitter().fit(ctx, font, 60, "A", "123456.78%", false),
      );
      expect(fit.valueSize).toBeGreaterThan(0);
      expect(sfWidth("123456.78%", fit.valueSize)).toBeLessThanOrEqual(90);
    });

    it("keeps a short label at 0.4r when that already fits", () => {
      const fit = defined(
        new LabelFitter().fit(ctx, font, 60, "A", null, false),
      );
      expect(fit.labelSize).toBe(24);
    });
  });
});
