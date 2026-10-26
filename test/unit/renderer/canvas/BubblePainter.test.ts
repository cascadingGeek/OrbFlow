/**
 * @jest-environment jsdom
 */
import {
  BubblePainter,
  type Bubble,
  type Look,
} from "../../../../app/renderer/canvas/BubblePainter";
import {
  defined,
  installFakeCanvas,
  type FakeContext,
} from "../../../support/fakeDom";

describe("BubblePainter (AC-6, AC-7)", () => {
  const dark: Look = {
    theme: "dark",
    filmAngle: 1.5,
    fontFamily: "Inter",
    minTextSize: 10,
  };
  const light: Look = { ...dark, theme: "light" };
  const bubble = (extra: Partial<Bubble> = {}): Bubble => ({
    x: 100,
    y: 100,
    r: 50,
    color: "#ff0000",
    label: "BTC",
    value: 9,
    valueText: "9%",
    ...extra,
  });

  const paint = (look: Look, b = bubble(), conic = true): FakeContext => {
    const contexts = installFakeCanvas({ conic });
    const ctx = defined(document.createElement("canvas").getContext("2d"));
    new BubblePainter().paint(ctx, b, look);
    return contexts[0];
  };
  const kinds = (ctx: FakeContext) => ctx.gradients.map((g) => g.kind);

  afterEach(() => jest.restoreAllMocks());

  it("draws the layers in recipe order: lift, body, film, glow, crescent, spot, glint", () => {
    expect(kinds(paint(dark))).toEqual([
      "radial",
      "radial",
      "conic",
      "radial",
      "linear",
      "radial",
      "radial",
    ]);
  });

  it("uses the dark stops: a tinted halo and a near clear center", () => {
    const [lift, body] = paint(dark).gradients;
    [100, 100, 48.5, 100, 100, 58].forEach((n, i) =>
      expect(lift.args[i]).toBeCloseTo(n),
    );
    expect(lift.stops[1]).toEqual([0.23, `rgba(255,0,0,${0.32 * 0.7})`]);
    expect(body.stops[0]).toEqual([0, `rgba(255,0,0,${0.05 * 0.7})`]);
    expect(body.stops[4]).toEqual([0.986, "rgba(255,255,255,0.7)"]);
  });

  it("uses the light stops: a lowered violet shadow and a white rim", () => {
    const [lift, body] = paint(light).gradients;
    [100, 115, 30, 100, 115, 62.5].forEach((n, i) =>
      expect(lift.args[i]).toBeCloseTo(n),
    );
    expect(lift.stops[0]).toEqual([0, "rgba(72,44,140,0.18)"]);
    expect(body.stops[0]).toEqual([0, "rgba(255,255,255,0.1)"]);
    expect(body.stops[4]).toEqual([0.986, "rgba(255,255,255,0.95)"]);
  });

  it("starts the film at the given angle, with the bubble color in it", () => {
    const film = paint(dark).gradients[2];
    expect(film.args).toEqual([1.5, 100, 100]);
    expect(film.stops.map((s) => s[0])).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
    expect(film.stops[3][1]).toBe("rgba(255,0,0,0.6)");
  });

  it("skips only the film where conic gradients do not exist", () => {
    expect(kinds(paint(dark, bubble(), false))).toEqual([
      "radial",
      "radial",
      "radial",
      "linear",
      "radial",
      "radial",
    ]);
  });

  it("tints an unparsable color blue instead of black", () => {
    const body = paint(dark, bubble({ color: "chartreuse" })).gradients[1];
    expect(body.stops[0][1]).toBe(`rgba(59,130,246,${0.05 * 0.7})`);
  });

  it("draws white labels in the dark theme and violet with a light edge in the light one", () => {
    const fills = (ctx: FakeContext) =>
      ctx.calls.filter((c) => c.method === "fillText").map((c) => c.args[0]);
    expect(fills(paint(dark))).toEqual(["BTC", "9%"]);
    expect(fills(paint(light))).toEqual(["BTC", "BTC", "9%", "9%"]);
  });

  it("draws nothing for a bubble with no size", () => {
    expect(paint(dark, bubble({ r: 0 })).calls).toHaveLength(0);
  });

  describe("image lens (AC-7)", () => {
    const image = (width: number, height: number) => {
      const img = document.createElement("img");
      Object.defineProperty(img, "naturalWidth", { value: width });
      Object.defineProperty(img, "naturalHeight", { value: height });
      return img;
    };

    it("crops a wide image to cover the 0.88r circle at 106%, then a vignette", () => {
      const ctx = paint(dark, bubble({ image: image(200, 100) }));
      const draw = defined(ctx.calls.find((c) => c.method === "drawImage"));
      const size = 2 * 44 * 1.06;
      expect(draw.args.slice(1)).toEqual([
        50,
        0,
        100,
        100,
        100 - size / 2,
        100 - size / 2,
        size,
        size,
      ]);
      const clip = ctx.calls[ctx.calls.indexOf(draw) - 2];
      expect(clip.args.slice(0, 3)).toEqual([100, 100, 44]);
      expect(kinds(ctx).slice(0, 3)).toEqual(["radial", "radial", "radial"]);
      expect(ctx.gradients[2].stops[1]).toEqual([1, "rgba(20,14,40,0.55)"]);
    });

    const textsOf = (ctx: FakeContext) =>
      ctx.calls.filter((c) => c.method === "fillText");

    it("draws the label low and no value over an image when the value text is empty", () => {
      const ctx = paint(dark, bubble({ image: image(10, 10), valueText: "" }));
      const texts = textsOf(ctx);
      expect(texts.map((c) => c.args[0])).toEqual(["BTC"]);
      expect(texts[0].args[2]).toBeCloseTo(100 + 0.45 * 50);
    });

    it("draws the value under the label over an image (spec 0007 AC-7)", () => {
      const texts = textsOf(paint(dark, bubble({ image: image(10, 10) })));
      expect(texts.map((c) => c.args[0])).toEqual(["BTC", "9%"]);
      expect(texts[1].args[2]).toBeGreaterThan(texts[0].args[2] as number);
    });

    it("hides a value that cannot reach minTextSize, and shows it once lowered", () => {
      const r = 40;
      const small = bubble({ r, valueText: "9%" });
      expect(textsOf(paint(dark, small))).toHaveLength(1);
      const lowered = { ...dark, minTextSize: 6 };
      expect(textsOf(paint(lowered, small)).map((c) => c.args[0])).toEqual([
        "BTC",
        "9%",
      ]);
    });
  });
});
