/**
 * @jest-environment jsdom
 */
import { EntranceGate } from "./EntranceGate";
import {
  FakeIntersectionObserver,
  installFakeIntersectionObserver,
} from "../test-support/fakeDom";

describe("EntranceGate (spec 0006 AC-3)", () => {
  let remove: () => void;
  let container: HTMLElement;

  beforeEach(() => {
    remove = installFakeIntersectionObserver();
    container = document.createElement("div");
  });

  afterEach(() => remove());

  it("watches the container with the 10% bottom margin", () => {
    new EntranceGate(container, jest.fn());
    const [observer] = FakeIntersectionObserver.instances;

    expect(observer.observed).toEqual([container]);
    expect(observer.options).toEqual({
      rootMargin: "0px 0px -10% 0px",
      threshold: 0,
    });
  });

  it("opens once on the first intersection, and never again", () => {
    const onOpen = jest.fn();
    const gate = new EntranceGate(container, onOpen);
    const [observer] = FakeIntersectionObserver.instances;
    expect(gate.open).toBe(false);

    observer.trigger(false);
    expect(gate.open).toBe(false);
    observer.trigger(true);
    observer.trigger(false);
    observer.trigger(true);

    expect(gate.open).toBe(true);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(observer.disconnected).toBe(true);
  });

  it("opens at once, without a callback, where there is no observer", () => {
    remove();
    const onOpen = jest.fn();
    const gate = new EntranceGate(container, onOpen);

    expect(gate.open).toBe(true);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("forceOpen opens for good without a callback and disconnects", () => {
    const onOpen = jest.fn();
    const gate = new EntranceGate(container, onOpen);
    const [observer] = FakeIntersectionObserver.instances;

    gate.forceOpen();

    expect(gate.open).toBe(true);
    expect(observer.disconnected).toBe(true);
    observer.trigger(true);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("ignores a callback that fires after dispose", () => {
    const onOpen = jest.fn();
    const gate = new EntranceGate(container, onOpen);
    const [observer] = FakeIntersectionObserver.instances;

    gate.dispose();
    observer.trigger(true);

    expect(observer.disconnected).toBe(true);
    expect(gate.open).toBe(false);
    expect(onOpen).not.toHaveBeenCalled();
  });
});
