/**
 * @jest-environment jsdom
 */
import {
  BurstEffects,
  BURST_MS,
  particle,
  type PopSnapshot,
} from "./BurstEffects";
import type { BubblePainter, Look } from "./BubblePainter";
import {
  defined,
  installFakeCanvas,
  type FakeContext,
} from "../test-support/fakeDom";

describe("BurstEffects (AC-10, AC-12)", () => {
  const look: Look = {
    theme: "dark",
    filmAngle: 0,
    fontFamily: "Inter",
    minTextSize: 10,
  };
  const snap: PopSnapshot = {
    id: "a",
    x: 100,
    y: 100,
    r: 40,
    color: "#ff0000",
    label: "A",
    value: 1,
    valueText: "1",
  };
  let fake: FakeContext;
  let ctx: CanvasRenderingContext2D;
  let painter: { body: jest.Mock; label: jest.Mock; tint: jest.Mock };
  let effects: BurstEffects;

  beforeEach(() => {
    const contexts = installFakeCanvas();
    ctx = defined(document.createElement("canvas").getContext("2d"));
    fake = contexts[0];
    painter = {
      body: jest.fn(),
      label: jest.fn(),
      tint: jest.fn(() => ({ r: 255, g: 0, b: 0, a: 1 })),
    };
    effects = new BurstEffects(painter as unknown as BubblePainter);
  });

  afterEach(() => jest.restoreAllMocks());

  const frameAt = (t: number) => {
    fake.calls.length = 0;
    painter.body.mockClear();
    effects.drawBursts(ctx, 1000 + t, look);
  };
  const ringArcs = () =>
    fake.calls.filter((c) => c.method === "arc" && c.args[0] === 100);

  it("stretches the body wider than tall over the first 81 ms", () => {
    effects.add(snap, 1000, false, false);
    frameAt(0);
    expect(painter.body.mock.calls[0].slice(3)).toEqual([1, 1]);
    frameAt(40.5);
    const [, , , sx, sy] = painter.body.mock.calls[0];
    expect(sx).toBeCloseTo(1.045);
    expect(sy).toBeCloseTo(1.025);
  });

  it("snaps to 1.2 and fades out by 180 ms", () => {
    effects.add(snap, 1000, false, false);
    frameAt(130.5);
    const [, , , sx, sy, alpha] = painter.body.mock.calls[0];
    expect(sx).toBeCloseTo(1.145);
    expect(sy).toBeCloseTo(1.125);
    expect(alpha).toBeCloseTo(0.5);
    frameAt(180);
    expect(painter.body).not.toHaveBeenCalled();
  });

  it("grows the shock ring from 0.98r to 1.55r between 90 and 470 ms", () => {
    effects.add(snap, 1000, false, false);
    frameAt(89);
    expect(ringArcs()).toHaveLength(0);
    frameAt(90);
    expect(ringArcs()[0].args[2]).toBeCloseTo(0.98 * 40);
    frameAt(469);
    expect(ringArcs()[0].args[2]).toBeCloseTo(40 * (0.98 + 0.57 * (379 / 380)));
  });

  it("throws six droplets and four specks with fixed angles and sizes", () => {
    expect(particle(0, 40)).toMatchObject({
      drop: true,
      angle: (-12 * Math.PI) / 180,
      size: 6.4,
      delay: 40,
      duration: 560,
    });
    expect(particle(1, 40).to).toBeCloseTo(40 * 1.65 + 18);
    expect(particle(9, 40)).toMatchObject({
      drop: false,
      size: 3,
      delay: 40,
      duration: 700,
      to: 1.9 * 40 + 24,
    });
    effects.add(snap, 1000, false, false);
    frameAt(300);
    expect(fake.calls.filter((c) => c.method === "translate")).toHaveLength(10);
  });

  it("ends after about 780 ms, and several bursts run at once", () => {
    effects.add(snap, 1000, false, false);
    effects.add({ ...snap, id: "b", x: 300 }, 1100, false, false);
    frameAt(200);
    expect(
      fake.calls.some((c) => c.method === "arc" && c.args[0] === 300),
    ).toBe(true);
    frameAt(BURST_MS);
    expect(
      fake.calls.filter((c) => c.method === "translate").length,
    ).toBeGreaterThan(0);
    frameAt(BURST_MS + 100);
    expect(fake.calls).toHaveLength(0);
  });

  it("draws a negative time as time 0", () => {
    effects.add(snap, 1000, false, false);
    frameAt(-50);
    expect(painter.body.mock.calls[0].slice(3)).toEqual([1, 1]);
  });

  it("plays no burst when idle", () => {
    effects.add(snap, 1000, false, true);
    frameAt(10);
    expect(fake.calls).toHaveLength(0);
  });

  describe("ghosts", () => {
    const dashed = () => fake.calls.filter((c) => c.method === "setLineDash");
    const drawGhosts = (now: number) => {
      fake.calls.length = 0;
      painter.label.mockClear();
      effects.drawGhosts(ctx, now, look);
    };

    it("fades a ghost in from 180 to 600 ms, with its label at 45%", () => {
      effects.add(snap, 1000, true, false);
      drawGhosts(1180);
      expect(dashed()).toHaveLength(0);
      drawGhosts(1390);
      expect(dashed()[0].args[0]).toEqual([6, 5]);
      expect(painter.label.mock.calls[0][3]).toBeCloseTo(0.45 * 0.5);
      drawGhosts(1600);
      expect(painter.label.mock.calls[0][3]).toBeCloseTo(0.45);
      expect(painter.label.mock.calls[0][1].image).toBeUndefined();
    });

    it("is fully there at once when made while idle", () => {
      effects.add(snap, 1000, true, true);
      drawGhosts(1000);
      expect(painter.label.mock.calls[0][3]).toBeCloseTo(0.45);
    });

    it("finishAll ends bursts and ghosts, and reports whether anything changed", () => {
      effects.add(snap, 1000, true, false);
      expect(effects.finishAll(1050)).toBe(true);
      expect(effects.finishAll(1060)).toBe(false);
      drawGhosts(1060);
      expect(painter.label.mock.calls[0][3]).toBeCloseTo(0.45);
      frameAt(60);
      expect(fake.calls).toHaveLength(0);
    });

    it("removes only the ghost of the restored bubble (spec 0006 AC-7)", () => {
      effects.add(snap, 1000, true, true);
      effects.add({ ...snap, id: "b", x: 200 }, 1000, true, true);

      effects.removeGhost("a");
      drawGhosts(2000);

      expect(dashed()).toHaveLength(1);
      expect(painter.label.mock.calls).toHaveLength(1);
      expect(painter.label.mock.calls[0][1].id).toBe("b");
      effects.removeGhost("zzz");
      drawGhosts(2000);
      expect(dashed()).toHaveLength(1);
    });

    it("clears ghosts, and clear() drops everything", () => {
      effects.add(snap, 1000, true, false);
      effects.clearGhosts();
      drawGhosts(2000);
      expect(dashed()).toHaveLength(0);
      effects.add(snap, 1000, true, false);
      effects.clear();
      drawGhosts(2000);
      frameAt(50);
      expect(fake.calls).toHaveLength(0);
    });
  });
});
