/**
 * @jest-environment jsdom
 */
import { AnimationLoop } from "../../../../app/core/playback/AnimationLoop";
import { Playback } from "../../../../app/core/playback/Playback";

describe("Playback", () => {
  let loop: AnimationLoop;
  let playback: Playback;

  beforeEach(() => {
    jest.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
    jest.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    loop = new AnimationLoop(() => {});
    playback = new Playback(loop);
  });

  afterEach(() => jest.restoreAllMocks());

  it("starts out unpaused and auto starts the loop", () => {
    expect(playback.paused).toBe(false);
    playback.autoStart();
    expect(loop.playing).toBe(true);
  });

  it("stays paused through autoStart until start is called", () => {
    playback.start();
    playback.pause();

    playback.autoStart();

    expect(playback.paused).toBe(true);
    expect(loop.playing).toBe(false);

    playback.start();
    expect(playback.paused).toBe(false);
    expect(loop.playing).toBe(true);
  });

  it("stop cancels the loop without marking a user pause", () => {
    playback.start();
    playback.stop();

    expect(loop.playing).toBe(false);
    expect(playback.paused).toBe(false);
  });

  describe("still mode", () => {
    it("is idle when paused or still, and running only with the loop", () => {
      expect(playback.idle).toBe(false);
      playback.setReduced(true);
      expect(playback.idle).toBe(true);
      expect(playback.reduced).toBe(true);
      playback.setReduced(false);
      playback.pause();
      expect(playback.idle).toBe(true);
      expect(playback.running).toBe(false);
    });

    it("does not run the loop for start or autoStart while still", () => {
      playback.setReduced(true);
      playback.start();
      playback.autoStart();
      expect(loop.playing).toBe(false);
      expect(playback.paused).toBe(false);
    });

    it("entering still stops the loop", () => {
      playback.start();
      playback.setReduced(true);
      expect(loop.playing).toBe(false);
    });

    it("leaving still restarts only a chart that wanted to run", () => {
      playback.setReduced(true);
      playback.setReduced(false);
      expect(loop.playing).toBe(false);

      playback.setReduced(true);
      playback.autoStart();
      playback.setReduced(false);
      expect(loop.playing).toBe(true);
    });

    it("never restarts a paused chart when leaving still", () => {
      playback.start();
      playback.pause();
      playback.setReduced(true);
      playback.setReduced(false);
      expect(loop.playing).toBe(false);
      expect(playback.paused).toBe(true);
    });
  });
});
