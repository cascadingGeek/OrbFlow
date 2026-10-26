import { Teardown } from "./Teardown";

describe("Teardown", () => {
  it("runs steps newest first", () => {
    const order: number[] = [];
    const teardown = new Teardown();
    teardown.add(() => order.push(1));
    teardown.add(() => order.push(2));
    teardown.add(() => order.push(3));

    teardown.run();

    expect(order).toEqual([3, 2, 1]);
  });

  it("runs each step once, so a second run does nothing", () => {
    const step = jest.fn();
    const teardown = new Teardown();
    teardown.add(step);

    teardown.run();
    teardown.run();

    expect(step).toHaveBeenCalledTimes(1);
  });

  it("owns a part: returns it and disposes it on run", () => {
    const part = { dispose: jest.fn() };
    const teardown = new Teardown();

    expect(teardown.own(part)).toBe(part);
    expect(part.dispose).not.toHaveBeenCalled();
    teardown.run();

    expect(part.dispose).toHaveBeenCalledTimes(1);
  });

  it("does nothing when empty", () => {
    expect(() => new Teardown().run()).not.toThrow();
  });
});
