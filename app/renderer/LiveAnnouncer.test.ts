/**
 * @jest-environment jsdom
 */
import { LiveAnnouncer } from "./LiveAnnouncer";

describe("LiveAnnouncer (AC-13)", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => container.remove());

  const region = () => container.querySelector("[aria-live]") as HTMLElement;

  it("adds a hidden polite region at once, empty", () => {
    new LiveAnnouncer(container);
    expect(region().getAttribute("aria-live")).toBe("polite");
    expect(region().style.position).toBe("absolute");
    expect(region().textContent).toBe("");
  });

  it("sets the text as text, never as HTML", () => {
    new LiveAnnouncer(container).announce("<b>x</b> popped");
    expect(region().textContent).toBe("<b>x</b> popped");
    expect(region().children).toHaveLength(0);
  });

  it("changes the text when the same thing is announced twice", () => {
    const announcer = new LiveAnnouncer(container);
    announcer.announce("BTC popped");
    announcer.announce("BTC popped");
    expect(region().textContent).toBe("BTC popped ");
    announcer.announce("BTC popped");
    expect(region().textContent).toBe("BTC popped");
  });

  it("removes the region on dispose", () => {
    new LiveAnnouncer(container).dispose();
    expect(container.children).toHaveLength(0);
  });
});
