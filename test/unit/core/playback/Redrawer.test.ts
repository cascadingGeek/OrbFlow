/**
 * @jest-environment jsdom
 */
import { AnimationLoop } from "./AnimationLoop";
import { Playback } from "./Playback";
import { Redrawer, type RedrawHost } from "./Redrawer";

describe("Redrawer (AC-8, AC-9, AC-10)", () => {
  let log: string[];
  let sized: boolean;
  let playback: Playback;
  let redrawer: Redrawer;

  beforeEach(() => {
    jest.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
    jest.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    log = [];
    sized = true;
    playback = new Playback(new AnimationLoop(() => {}));
    const host: RedrawHost = {
      now: () => 5,
      sized: () => sized,
      snap: () => log.push("snap"),
      settleOrbs: () => log.push("settle"),
      draw: (now) => log.push(`draw@${now}`),
      setStill: (still) => log.push(`still:${still}`),
    };
    redrawer = new Redrawer(playback, host);
  });

  afterEach(() => jest.restoreAllMocks());

  it("only draws for a paused chart that is not still", () => {
    playback.pause();
    redrawer.run();
    expect(log).toEqual(["draw@5"]);
  });

  it("snaps, settles, then draws once for a still chart", () => {
    redrawer.apply(true);
    log.length = 0;
    redrawer.run();
    expect(log).toEqual(["snap", "settle", "draw@5"]);
  });

  it("skips the settle for a change that moves nothing", () => {
    redrawer.apply(true);
    log.length = 0;
    redrawer.run(false);
    expect(log).toEqual(["draw@5"]);
  });

  it("does nothing while the container has no size", () => {
    redrawer.apply(true);
    log.length = 0;
    sized = false;
    redrawer.run();
    expect(log).toEqual([]);
  });

  it("never settles a paused still chart, and owes the settle to start()", () => {
    playback.start();
    playback.pause();
    redrawer.apply(true);
    log.length = 0;

    redrawer.run();
    expect(log).toEqual(["draw@5"]);

    log.length = 0;
    playback.start();
    redrawer.begin();
    expect(log).toEqual(["snap", "settle", "draw@5"]);
    expect(playback.running).toBe(false);
  });

  it("draws once on start() when nothing is owed, and not at all if not still", () => {
    redrawer.begin();
    expect(log).toEqual([]);

    redrawer.apply(true);
    log.length = 0;
    redrawer.begin();
    expect(log).toEqual(["draw@5"]);
  });

  it("settles when the chart goes still, and clears the debt when it leaves", () => {
    playback.start();
    redrawer.flipped(true);
    expect(log).toEqual(["still:true", "snap", "settle", "draw@5"]);
    expect(playback.running).toBe(false);

    log.length = 0;
    redrawer.flipped(false);
    expect(log).toEqual(["still:false"]);
    expect(playback.running).toBe(true);
  });

  it("draws once when a paused chart leaves still mode", () => {
    playback.start();
    playback.pause();
    redrawer.flipped(true);
    log.length = 0;
    redrawer.flipped(false);
    expect(log).toEqual(["still:false", "draw@5"]);
    expect(playback.running).toBe(false);
  });
});
