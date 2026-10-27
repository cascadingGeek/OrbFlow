/**
 * @jest-environment jsdom
 */
import "@test/support/serverGlobals";
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { OrbChart } from "@/react/OrbChart";
import {
  installFakeCanvas,
  installFakeResizeObserver,
  installFrameQueue,
} from "@test/support/fakeDom";

describe("<OrbChart> hydration (AC-2, AC-12)", () => {
  it("hydrates server markup without a mismatch and adds one canvas", async () => {
    installFakeCanvas();
    installFakeResizeObserver();
    installFrameQueue();
    jest
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(
        () =>
          ({ width: 400, height: 300, top: 0, left: 0 }) as unknown as DOMRect,
      );
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    const element = (
      <OrbChart data={[{ id: "a", label: "A", value: 1 }]} className="c" />
    );
    const host = document.createElement("div");
    host.innerHTML = renderToString(element);
    document.body.appendChild(host);
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;

    let root!: ReturnType<typeof hydrateRoot>;
    await act(async () => {
      root = hydrateRoot(host, element);
    });

    expect(error).not.toHaveBeenCalled();
    expect(host.querySelectorAll("canvas")).toHaveLength(1);
    expect(host.querySelectorAll("ul")).toHaveLength(1);
    expect(host.querySelectorAll("button")).toHaveLength(1);
    act(() => root.unmount());
    host.remove();
    jest.restoreAllMocks();
  });
});
