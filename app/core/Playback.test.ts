/**
 * @jest-environment jsdom
 */
import { AnimationLoop } from "./AnimationLoop";
import { Playback } from "./Playback";

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
});
