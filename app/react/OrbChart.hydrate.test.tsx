/**
 * @jest-environment jsdom
 */
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { TextDecoder, TextEncoder } from "node:util";
import { OrbChart } from "./OrbChart";
import {
  installFakeCanvas,
  installFakeResizeObserver,
  installFrameQueue,
} from "../test-support/fakeDom";

// A channel that never opens a port, so no handle is left running.
function StubChannel(this: { port1: object; port2: object }) {
  this.port1 = { postMessage: () => undefined };
  this.port2 = {};
}

describe("<OrbChart> hydration (AC-2)", () => {
  it("hydrates server markup without a mismatch and adds one canvas", async () => {
    // jsdom lacks these, which the server renderer needs when loaded.
    Object.assign(globalThis, {
      TextEncoder,
      TextDecoder,
      MessageChannel: StubChannel,
    });
    const { renderToString } = await import("react-dom/server");
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
    act(() => root.unmount());
    host.remove();
    jest.restoreAllMocks();
  });
});
