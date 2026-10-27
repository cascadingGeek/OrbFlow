import type { Orb } from "@/types/types";

/** Who showed the tooltip. Only the owner can hide it. */
type TooltipOwner = "pointer" | "focus";

/** The chart size the tooltip is clamped to. */
interface TooltipBounds {
  width?: number;
  height?: number;
}

/**
 * Creates, fills, places, and hides the `aria-hidden` tooltip. Pointer and
 * focus share it: the last one to show it owns it, and only it can hide it.
 */
export class TooltipView {
  private el: HTMLDivElement | null = null;
  private key = "";
  private current: TooltipOwner | null = null;
  private fade = true;
  private shown: Orb | null = null;

  /** `valueTextOf` gives the value text the canvas draws for an orb. */
  constructor(
    private readonly container: HTMLElement,
    private readonly getBounds: () => TooltipBounds,
    private readonly valueTextOf: (orb: Orb) => string = (orb) =>
      String(orb.value),
  ) {}

  /** Who is showing the tooltip now, or `null` when it is hidden. */
  get owner(): TooltipOwner | null {
    return this.current;
  }

  /** Creates or removes the element to match `enabled`. */
  setEnabled(enabled: boolean) {
    if (enabled && !this.el) {
      this.el = this.create();
    } else if (!enabled && this.el) {
      this.el.remove();
      this.el = null;
      this.key = "";
      this.current = null;
    }
  }

  /** Turns the opacity transition on or off, also while it is showing. */
  setFade(on: boolean) {
    this.fade = on;
    if (this.el) this.el.style.transition = this.transition();
  }

  /**
   * Fills the tooltip for `orb` and places it at `x`, `y`. `above` centers it
   * over the point, as touch does. It is moved back inside the chart bounds.
   */
  show(orb: Orb, x: number, y: number, above: boolean, owner: TooltipOwner) {
    const tip = this.el;
    if (!tip) return;
    this.fill(orb);

    const { width, height } = this.getBounds();
    const rect = tip.getBoundingClientRect();
    let left = x;
    let top = y;
    if (above) {
      left = Math.max(0, x - rect.width / 2);
      top = Math.max(0, y - rect.height - 20);
    }
    if (width !== undefined && left + rect.width > width)
      left -= rect.width + 20;
    if (height !== undefined && top + rect.height > height)
      top -= rect.height + 20;

    // A bubble below the canvas (still parked) gets a tooltip inside it.
    if (width !== undefined) left = clamp(left, width - rect.width);
    if (height !== undefined) top = clamp(top, height - rect.height);

    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
    tip.style.opacity = "1";
    this.current = owner;
  }

  /** Rewrites the text when it differs from what is shown. */
  refill(orb: Orb) {
    if (this.el && this.key !== this.keyOf(orb)) this.fill(orb);
  }

  /** Rewrites the open tooltip when its text changed since it was filled. */
  refreshOpen() {
    if (this.current && this.shown) this.refill(this.shown);
  }

  /** Hides the tooltip, but only for the owner that showed it. */
  hide(owner: TooltipOwner) {
    if (this.current !== owner) return;
    if (this.el) this.el.style.opacity = "0";
    this.current = null;
  }

  dispose() {
    this.el?.remove();
    this.el = null;
    this.current = null;
  }

  private keyOf(orb: Orb): string {
    const value = this.valueTextOf(orb);
    return `${orb.label}\n${value}\n${String(orb.metadata?.category ?? "")}`;
  }

  private fill(orb: Orb) {
    if (!this.el) return;
    // Orb data is user supplied: set it as text, never as HTML.
    const lines = [
      this.line(orb.label, "font-weight: 600; margin-bottom: 2px;"),
    ];
    const value = this.valueTextOf(orb);
    if (value) {
      lines.push(
        this.line(`Value: ${value}`, "font-size: 12px; opacity: 0.8;"),
      );
    }
    if (orb.metadata?.category) {
      lines.push(
        this.line(
          String(orb.metadata.category),
          "font-size: 11px; opacity: 0.6; margin-top: 2px;",
        ),
      );
    }
    this.el.replaceChildren(...lines);
    this.key = this.keyOf(orb);
    this.shown = orb;
  }

  private line(text: string, style: string): HTMLDivElement {
    const line = document.createElement("div");
    line.style.cssText = style;
    line.textContent = text;
    return line;
  }

  private transition(): string {
    return this.fade ? "opacity 0.2s" : "none";
  }

  private create(): HTMLDivElement {
    const tip = document.createElement("div");
    tip.setAttribute("aria-hidden", "true");
    tip.style.cssText = `
      position: absolute;
      background: rgba(15, 23, 42, 0.9);
      color: white;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 14px;
      pointer-events: none;
      opacity: 0;
      z-index: 1000;
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    `;
    tip.style.transition = this.transition();
    this.container.appendChild(tip);
    return tip;
  }
}

function clamp(value: number, max: number): number {
  return Math.min(Math.max(0, value), Math.max(0, max));
}
