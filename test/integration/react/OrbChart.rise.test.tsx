/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import { StrictMode } from "react";
import { render } from "@testing-library/react";
import { OrbChart } from "@/react/OrbChart";
import {
  FakeIntersectionObserver,
  installFakeCanvas,
  installFakeIntersectionObserver,
  installFakeResizeObserver,
  installFrameQueue,
} from "@test/support/fakeDom";

const data = [
  { id: "a", label: "Alpha", value: 40 },
  { id: "b", label: "Beta", value: 25 },
];

describe("<OrbChart> entrance gate (spec 0006 AC-13, AC-15)", () => {
  let removeObserver: () => void;

  beforeEach(() => {
    installFakeCanvas();
    installFakeResizeObserver();
    installFrameQueue();
    removeObserver = installFakeIntersectionObserver();
    jest.spyOn(Math, "random").mockReturnValue(0.5);
    jest
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(
        () =>
          ({ width: 400, height: 300, top: 0, left: 0 }) as unknown as DOMRect,
      );
  });

  afterEach(() => {
    removeObserver();
    jest.restoreAllMocks();
  });

  it("leaves one live observer after a strict mode mount, unmount, mount", () => {
    const { unmount } = render(
      <StrictMode>
        <OrbChart data={data} />
      </StrictMode>,
    );

    expect(FakeIntersectionObserver.live).toBe(1);
    unmount();
    expect(FakeIntersectionObserver.live).toBe(0);
  });

  it("disconnects the observer on unmount before the chart was seen", () => {
    const { unmount } = render(<OrbChart data={data} />);
    const [observer] = FakeIntersectionObserver.instances;

    unmount();

    expect(observer.disconnected).toBe(true);
    expect(() => observer.trigger(true)).not.toThrow();
  });
});
