import type { Orb } from "../types/types";
import type { TooltipView } from "./TooltipView";

/** What the focus cue draws with and asks for. */
export interface FocusCueHost {
  tooltip: TooltipView;
  /** Sets the orb that gets the focus ring, or `null`. */
  setRing(id: string | null): void;
  /** Where the orb is drawn right now, with its float offset. */
  centerOf(orb: Orb): { x: number; y: number };
  /** Draws once if no loop is doing it. */
  redraw(): void;
}

/**
 * Shows where keyboard focus is: the ring on the canvas and the tooltip
 * beside the orb. Escape hides the tooltip until focus moves to another orb.
 */
export class FocusCue {
  private orb: Orb | null = null;
  private dismissedId: string | null = null;

  constructor(private readonly host: FocusCueHost) {}

  /** Focus moved to `orb`, or left the list when `null`. */
  focus(orb: Orb | null) {
    const { tooltip } = this.host;
    if (orb?.id !== this.dismissedId) this.dismissedId = null;
    this.orb = orb;
    this.host.setRing(orb?.id ?? null);
    if (!orb) {
      tooltip.hide("focus");
    } else if (this.dismissedId === null) {
      const { x, y } = this.host.centerOf(orb);
      const offset = orb.radius * 0.7 + 8;
      tooltip.show(orb, x + offset, y + offset, false, "focus");
    }
    this.host.redraw();
  }

  /** Hides a visible focus tooltip. Returns true only if it hid one. */
  escape(): boolean {
    const { tooltip } = this.host;
    if (!this.orb || tooltip.owner !== "focus") return false;
    this.dismissedId = this.orb.id;
    tooltip.hide("focus");
    return true;
  }

  /** Refills the tooltip when `setData` changed the focused orb's text. */
  refresh() {
    if (this.orb && this.host.tooltip.owner === "focus") {
      this.host.tooltip.refill(this.orb);
    }
  }
}
