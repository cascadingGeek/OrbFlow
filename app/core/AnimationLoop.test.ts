/**
 * @jest-environment jsdom
 */
import { AnimationLoop } from "./AnimationLoop";
import { installFrameQueue } from "../test-support/fakeDom";

describe("AnimationLoop", () => {
  let frames: ReturnType<typeof installFrameQueue>;
  let clock: number;

  beforeEach(() => {
    frames = installFrameQueue();
    clock = 100;
  });
  afterEach(() => jest.restoreAllMocks());

  const makeLoop = (onFrame = jest.fn()) => ({
    onFrame,
    loop: new AnimationLoop(onFrame, () => clock),
  });

  it("draws a frame at once on start, with the injected clock", () => {
    const { loop, onFrame } = makeLoop();

    loop.start();

    expect(onFrame).toHaveBeenCalledWith(100);
    expect(loop.playing).toBe(true);
    expect(frames.pending()).toBe(1);
  });

  it("reads the clock once per frame", () => {
    const { loop, onFrame } = makeLoop();
    loop.start();
    clock = 116;

    frames.step();

    expect(onFrame).toHaveBeenLastCalledWith(116);
    expect(onFrame).toHaveBeenCalledTimes(2);
  });

  it("does not queue a second frame when started twice", () => {
    const { loop, onFrame } = makeLoop();

    loop.start();
    loop.start();

    expect(onFrame).toHaveBeenCalledTimes(1);
    expect(frames.pending()).toBe(1);
  });

  it("cancels the queued frame on stop and can start again", () => {
    const { loop, onFrame } = makeLoop();
    loop.start();

    loop.stop();
    expect(frames.pending()).toBe(0);
    expect(loop.playing).toBe(false);

    loop.start();
    expect(onFrame).toHaveBeenCalledTimes(2);
    expect(frames.pending()).toBe(1);
  });

  it("stops asking for frames when stopped from inside a frame", () => {
    const loop: AnimationLoop = new AnimationLoop(
      () => loop.stop(),
      () => clock,
    );

    loop.start();

    expect(frames.pending()).toBe(0);
  });
});
