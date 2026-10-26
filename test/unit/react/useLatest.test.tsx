/**
 * @jest-environment jsdom
 */
import { renderHook } from "@testing-library/react";
import { useLatest } from "../../../app/react/useLatest";

describe("useLatest", () => {
  it("starts with the first value", () => {
    const { result } = renderHook(() => useLatest("a"));
    expect(result.current.current).toBe("a");
  });

  it("holds the newest value after a re-render, in the same ref object", () => {
    const { result, rerender } = renderHook(({ v }) => useLatest(v), {
      initialProps: { v: "a" },
    });
    const ref = result.current;

    rerender({ v: "b" });

    expect(result.current).toBe(ref);
    expect(ref.current).toBe("b");
  });
});
