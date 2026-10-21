import { ChartPopHost, type ChartPopParts } from "./ChartPopHost";
import type { Orb } from "../types/types";
import type { PopRecord } from "./PopLedger";
import type { ResolvedConfig } from "./ConfigResolver";
import type { PopSnapshot } from "../renderer/BurstEffects";

const orb = (id: string): Orb => ({
  id,
  label: id,
  value: 1,
  radius: 10,
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
});

const record = (index: number): PopRecord => ({
  id: "r",
  label: "r",
  value: 1,
  x: 5,
  y: 6,
  index,
  byUser: true,
});

/** Fakes at the chart's own seams, with the call order recorded. */
const makeParts = (initial: Orb[], paused = false, idle = false) => {
  let list = initial;
  const calls: string[] = [];
  const restored = orb("r");
  const parts = {
    view: {
      snapshotOf: jest.fn((_o: Orb, placed: boolean) => {
        calls.push(`snapshot ${placed}`);
        return null;
      }),
      syncInput: jest.fn(() => calls.push("syncInput")),
      syncList: jest.fn(() => calls.push("syncList")),
      burst: jest.fn(),
      announce: jest.fn(),
      removeGhost: jest.fn(),
      preloadImages: jest.fn(() => calls.push("preload")),
    },
    physics: { applyMouseRepulsion: jest.fn() },
    reconciler: {
      awaiting: jest.fn(() => false),
      drop: jest.fn(),
      restoreOrb: jest.fn(() => restored),
    },
    rises: {
      forget: jest.fn(),
      start: jest.fn(() => calls.push("rise")),
    },
    ledger: {},
    orbs: {
      all: () => list,
      set: (next: Orb[]) => {
        list = next;
      },
      live: () => list,
    },
    config: () => ({ restoreOnNextPop: true }) as unknown as ResolvedConfig,
    now: () => 42,
    playback: { idle, paused },
    redraw: jest.fn((settle: boolean) => calls.push(`redraw ${settle}`)),
  };
  return {
    parts,
    calls,
    restored,
    host: new ChartPopHost(parts as unknown as ChartPopParts),
    current: () => list,
  };
};

describe("ChartPopHost (spec 0006 AC-7 to AC-10)", () => {
  it("finds a live orb by id, and null when it is gone", () => {
    const a = orb("a");
    const { host } = makeParts([a, orb("b")]);
    expect(host.live("a")).toBe(a);
    expect(host.live("zzz")).toBeNull();
  });

  it("reports the position of an orb in the live list", () => {
    const [a, b] = [orb("a"), orb("b")];
    const { host } = makeParts([a, b]);
    expect(host.indexOf(b)).toBe(1);
    expect(host.indexOf(orb("x"))).toBe(-1);
  });

  it("takes a snapshot as placed only when the orb is not awaiting its first place", () => {
    const a = orb("a");
    const { host, parts } = makeParts([a]);
    host.snapshotOf(a);
    parts.reconciler.awaiting.mockReturnValue(true);
    host.snapshotOf(a);
    expect(parts.view.snapshotOf).toHaveBeenNthCalledWith(1, a, true);
    expect(parts.view.snapshotOf).toHaveBeenNthCalledWith(2, a, false);
  });

  it("removes an orb and forgets it everywhere before the input and list resync", () => {
    const [a, b] = [orb("a"), orb("b")];
    const { host, parts, calls, current } = makeParts([a, b]);

    host.remove(a);

    expect(current()).toEqual([b]);
    expect(parts.reconciler.drop).toHaveBeenCalledWith("a");
    expect(parts.rises.forget).toHaveBeenCalledWith("a");
    expect(parts.view.syncInput).toHaveBeenCalledWith([b]);
    expect(parts.view.syncList).toHaveBeenCalledWith([b]);
    expect(calls).toEqual(["syncInput", "syncList"]);
  });

  it("bursts with the chart clock, never its own", () => {
    const { host, parts } = makeParts([]);
    const snap = {} as PopSnapshot;
    host.burst(snap, true);
    expect(parts.view.burst).toHaveBeenCalledWith(snap, 42, true);
  });

  it("pushes neighbours from every orb, also the ones shrinking out", () => {
    const all = [orb("a"), orb("b")];
    const { host, parts } = makeParts(all);
    host.push(1, 2, 3, 4);
    expect(parts.physics.applyMouseRepulsion).toHaveBeenCalledWith(
      all,
      1,
      2,
      3,
      4,
    );
  });

  it("rebuilds an orb at its old index, clamped to the end of the live list", () => {
    const [a, b] = [orb("a"), orb("b")];
    const first = makeParts([a, b]);
    first.host.rebuild(record(1));
    expect(first.current().map((o) => o.id)).toEqual(["a", "r", "b"]);

    const clamped = makeParts([a, b]);
    clamped.host.rebuild(record(99));
    expect(clamped.current().map((o) => o.id)).toEqual(["a", "b", "r"]);
  });

  it("clears a ghost through the view", () => {
    const { host, parts } = makeParts([]);
    host.clearGhost("g");
    expect(parts.view.removeGhost).toHaveBeenCalledWith("g");
  });

  describe("arrive", () => {
    it("resyncs input and list, preloads images, and starts the rise", () => {
      const a = orb("a");
      const { host, calls, parts } = makeParts([a]);
      host.arrive([a]);
      expect(calls).toEqual(["syncInput", "syncList", "preload", "rise"]);
      expect(parts.rises.start).toHaveBeenCalledWith([a], 42);
      expect(parts.redraw).not.toHaveBeenCalled();
    });

    it("draws once for an idle chart, settling a still chart (AC-6)", () => {
      const a = orb("a");
      const still = makeParts([a], false, true);
      still.host.arrive([a]);
      expect(still.parts.redraw).toHaveBeenCalledWith(true);
    });

    it("draws once for a paused chart without settling it (AC-6)", () => {
      const a = orb("a");
      const paused = makeParts([a], true, true);
      paused.host.arrive([a]);
      expect(paused.parts.redraw).toHaveBeenCalledWith(false);
    });
  });
});
