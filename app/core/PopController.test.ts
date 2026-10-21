/**
 * @jest-environment jsdom
 */
import { PopController, type PopHost } from "./PopController";
import { PopLedger } from "./PopLedger";
import type { Orb } from "../types/types";

const orb = (id: string, label = id.toUpperCase()): Orb => ({
  id,
  label,
  value: 1,
  radius: 20,
  x: 10,
  y: 20,
  vx: 0,
  vy: 0,
});

/** A host that records every call, in order, and keeps a live list. */
function makeHost(initial: Orb[], idle = false) {
  const calls: string[] = [];
  let live = [...initial];
  const config = {
    onOrbClick: jest.fn(() => calls.push("onOrbClick")),
    onOrbPop: jest.fn((o: Orb) => calls.push(`onOrbPop ${o.id}`)),
    onOrbRestore: jest.fn((o: Orb) => calls.push(`onOrbRestore ${o.id}`)),
    popOnClick: true,
    restoreOnNextPop: true,
  };
  const ledger = new PopLedger();
  const host: PopHost = {
    ledger,
    live: (id) => live.find((o) => o.id === id) ?? null,
    indexOf: (o) => live.indexOf(o),
    snapshotOf: () => ({
      id: "s",
      x: 1,
      y: 2,
      r: 3,
      color: "#fff",
      label: "",
      value: 1,
    }),
    remove: (o) => {
      calls.push(`remove ${o.id}`);
      live = live.filter((other) => other !== o);
    },
    burst: () => calls.push("burst"),
    announce: (text) => calls.push(`announce ${text}`),
    push: () => calls.push("push"),
    idle: () => idle,
    redraw: (settle) => calls.push(`redraw ${String(settle)}`),
    config: () => config,
    rebuild: (record) => {
      calls.push(`rebuild ${record.id}`);
      const back = orb(record.id, record.label);
      live.splice(Math.min(record.index, live.length), 0, back);
      return back;
    },
    clearGhost: (id) => calls.push(`clearGhost ${id}`),
    arrive: (orbs) => calls.push(`arrive ${orbs.map((o) => o.id).join(",")}`),
  };
  return { host, calls, config, ledger, ids: () => live.map((o) => o.id) };
}
const click = new MouseEvent("click");

describe("PopController (spec 0006)", () => {
  afterEach(() => jest.restoreAllMocks());

  it("remembers the popped bubble with its place and list index (AC-9)", () => {
    const { host, ledger } = makeHost([orb("a"), orb("b"), orb("c")]);

    new PopController(host).pop("b");

    expect(ledger.get("b")).toEqual({
      id: "b",
      label: "B",
      value: 1,
      color: undefined,
      imageUrl: undefined,
      metadata: undefined,
      x: 10,
      y: 20,
      index: 1,
      byUser: false,
    });
  });

  it("restores in order: ghost, rebuild, arrive, announce, callback (AC-7)", () => {
    const { host, calls } = makeHost([orb("a"), orb("b")]);
    const pops = new PopController(host);
    pops.pop("a");
    calls.length = 0;

    expect(pops.restore("a")).toBe(true);

    expect(calls).toEqual([
      "clearGhost a",
      "rebuild a",
      "arrive a",
      "announce A restored",
      "onOrbRestore a",
    ]);
  });

  it("returns false and does nothing for unknown, live, and already restored ids (AC-7, AC-12)", () => {
    const { host, calls } = makeHost([orb("a"), orb("b")]);
    const pops = new PopController(host);
    expect(pops.restore("zzz")).toBe(false);
    expect(pops.restore("a")).toBe(false);
    expect(pops.restore()).toBe(false);
    expect(calls).toEqual([]);

    pops.pop("a");
    pops.restore("a");
    expect(pops.restore("a")).toBe(false);
  });

  it("restores a batch last popped first, with one message (AC-7, AC-11)", () => {
    const { host, calls, ids } = makeHost([orb("a"), orb("b"), orb("c")]);
    const pops = new PopController(host);
    pops.pop("a");
    pops.pop("c");
    pops.pop("b");
    calls.length = 0;

    expect(pops.restore()).toBe(true);

    expect(calls.filter((c) => c.startsWith("rebuild"))).toEqual([
      "rebuild b",
      "rebuild c",
      "rebuild a",
    ]);
    expect(calls.filter((c) => c.startsWith("announce"))).toEqual([
      "announce 3 bubbles restored",
    ]);
    expect(calls.filter((c) => c.startsWith("arrive"))).toHaveLength(1);
    expect(ids()).toHaveLength(3);
  });

  it("uses the id when the label is empty (AC-11)", () => {
    const { host, calls } = makeHost([orb("x", "")]);
    const pops = new PopController(host);
    pops.pop("x");

    pops.restore("x");

    expect(calls).toContain("announce x restored");
  });

  it("logs and survives a throwing onOrbRestore, still calling the rest (AC-11)", () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    const { host, config } = makeHost([orb("a"), orb("b")]);
    config.onOrbRestore.mockImplementation(() => {
      throw new Error("boom");
    });
    const pops = new PopController(host);
    pops.pop("a");
    pops.pop("b");

    expect(pops.restore()).toBe(true);

    expect(config.onOrbRestore).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledTimes(2);
  });

  describe("activate (AC-10, AC-11)", () => {
    it("reports the click, restores what the user popped, then pops, with one message", () => {
      const { host, calls } = makeHost([orb("a"), orb("b"), orb("c")]);
      const pops = new PopController(host);
      pops.activate(orb("a"), click);
      calls.length = 0;
      const b = host.live("b") as Orb;

      pops.activate(b, click);

      expect(
        calls.filter((c) => !c.startsWith("burst") && c !== "push"),
      ).toEqual([
        "onOrbClick",
        "clearGhost a",
        "rebuild a",
        "arrive a",
        "onOrbRestore a",
        "remove b",
        "onOrbPop b",
        "announce A restored, B popped",
      ]);
    });

    it("pops alone, announcing only the pop, when nothing was popped before", () => {
      const { host, calls } = makeHost([orb("a"), orb("b")]);

      new PopController(host).activate(orb("a"), click);

      expect(calls.filter((c) => c.startsWith("announce"))).toEqual([
        "announce A popped",
      ]);
      expect(calls.some((c) => c.startsWith("rebuild"))).toBe(false);
    });

    it("never restores bubbles that code popped", () => {
      const { host, calls, ids } = makeHost([orb("a"), orb("b"), orb("c")]);
      const pops = new PopController(host);
      pops.pop("a");
      calls.length = 0;

      pops.activate(host.live("b") as Orb, click);

      expect(ids()).toEqual(["c"]);
      expect(calls.some((c) => c.startsWith("rebuild"))).toBe(false);
    });

    it("restores nothing when restoreOnNextPop is off, and neither restores nor pops when popOnClick is off", () => {
      const first = makeHost([orb("a"), orb("b")]);
      first.config.restoreOnNextPop = false;
      const pops = new PopController(first.host);
      pops.activate(orb("a"), click);
      pops.activate(first.host.live("b") as Orb, click);
      expect(first.ids()).toEqual([]);

      const second = makeHost([orb("a"), orb("b")]);
      second.config.popOnClick = false;
      new PopController(second.host).activate(orb("a"), click);
      expect(second.ids()).toEqual(["a", "b"]);
      expect(second.calls).toEqual(["onOrbClick"]);
    });

    it("still announces the restore when onOrbClick already popped the clicked bubble", () => {
      const { host, calls } = makeHost([orb("a"), orb("b")]);
      const pops = new PopController(host);
      pops.activate(orb("a"), click);
      calls.length = 0;
      host.config().onOrbClick = () => {
        pops.pop("b");
      };
      calls.length = 0;

      pops.activate(host.live("b") as Orb, click);

      expect(calls).toContain("announce A restored");
    });
  });

  it("redraws an idle chart after a pop, and plays no push (AC-6)", () => {
    const { host, calls } = makeHost([orb("a")], true);

    new PopController(host).pop("a");

    expect(calls).toContain("redraw undefined");
    expect(calls).not.toContain("push");
  });
});
