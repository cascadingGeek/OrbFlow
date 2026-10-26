import { HIDDEN_STYLE } from "./listDom";

/**
 * A visually hidden polite live region, beside the accessible list (never
 * inside it), that tells screen reader users what just happened.
 */
export class LiveAnnouncer {
  private readonly region = document.createElement("div");

  constructor(container: HTMLElement) {
    this.region.setAttribute("aria-live", "polite");
    this.region.style.cssText = HIDDEN_STYLE;
    container.appendChild(this.region);
  }

  /**
   * Announces `text`. The same text twice in a row gets a trailing no break
   * space, so it still counts as a change and is read again.
   */
  announce(text: string) {
    const current = this.region.textContent ?? "";
    // Text is user supplied: always set as text, never as HTML.
    this.region.textContent = current === text ? `${text}\u00a0` : text;
  }

  dispose() {
    this.region.remove();
  }
}
