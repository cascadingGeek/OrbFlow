import type { Orb, OrbChartConfig } from "../types/types";
import type { TooltipView } from "./TooltipView";

const TOUCH_TOOLTIP_MS = 2500;

/** The pieces of config the input layer reads, looked up on every event. */
export type InputConfig = Pick<
  OrbChartConfig,
  "enableTooltip" | "onOrbClick" | "onOrbHover" | "width" | "height"
>;

/**
 * Owns every canvas listener. It hit tests, drives the shared tooltip for the
 * pointer, runs the touch tooltip timer, and removes everything in `dispose()`.
 */
export class CanvasInput {
  private liveOrbs: Orb[] = [];
  private hoveredOrb: Orb | null = null;
  private lastPointerType = "mouse";
  private touchTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  private readonly listeners: [string, EventListener][] = [
    ["pointerdown", (e) => this.onPointerDown(e as PointerEvent)],
    ["pointermove", (e) => this.onPointerMove(e as PointerEvent)],
    ["pointerleave", (e) => this.onPointerLeave(e as PointerEvent)],
    ["click", (e) => this.onClick(e as MouseEvent)],
  ];

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly tooltip: TooltipView,
    private readonly getConfig: () => InputConfig,
    private readonly onCanvasClick: (x: number, y: number) => void,
  ) {
    for (const [type, listener] of this.listeners) {
      canvas.addEventListener(type, listener);
    }
    this.refresh();
  }

  /** Creates or removes the tooltip to match `enableTooltip`. */
  refresh() {
    this.tooltip.setEnabled(Boolean(this.getConfig().enableTooltip));
  }

  /** Gives the orbs that can be hit, and clears a hover that went stale. */
  sync(liveOrbs: Orb[]) {
    this.liveOrbs = liveOrbs;
    if (!this.hoveredOrb) return;
    if (!liveOrbs.includes(this.hoveredOrb)) {
      this.clearHover();
    } else if (this.tooltip.owner === "pointer") {
      this.tooltip.refill(this.hoveredOrb);
    }
  }

  /** Removes every listener, the timer, and the tooltip. */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const [type, listener] of this.listeners) {
      this.canvas.removeEventListener(type, listener);
    }
    this.clearTimer();
    this.tooltip.dispose();
    this.hoveredOrb = null;
  }

  private onPointerDown(event: PointerEvent) {
    this.lastPointerType = event.pointerType || "mouse";
  }

  private onPointerMove(event: PointerEvent) {
    if (event.pointerType === "touch") return;
    const orb = this.hit(event.offsetX, event.offsetY);
    this.setHover(orb);
    if (orb)
      this.tooltip.show(
        orb,
        event.offsetX + 15,
        event.offsetY + 15,
        false,
        "pointer",
      );
    else this.tooltip.hide("pointer");
  }

  private onPointerLeave(event: PointerEvent) {
    if (event.pointerType === "touch") return;
    this.clearHover();
  }

  private onClick(event: MouseEvent) {
    const { offsetX: x, offsetY: y } = event;
    const pointerType =
      (event as PointerEvent).pointerType || this.lastPointerType;
    this.onCanvasClick(x, y);

    const orb = this.hit(x, y);
    if (pointerType === "touch") {
      if (!orb) {
        this.clearHover();
        return;
      }
      this.setHover(orb);
      this.tooltip.show(orb, x, y, true, "pointer");
      this.restartTimer();
    }
    if (orb) this.getConfig().onOrbClick?.(orb, event);
  }

  private setHover(orb: Orb | null) {
    if (orb === this.hoveredOrb) return;
    this.hoveredOrb = orb;
    this.getConfig().onOrbHover?.(orb);
  }

  private clearHover() {
    this.clearTimer();
    this.tooltip.hide("pointer");
    this.setHover(null);
  }

  private restartTimer() {
    this.clearTimer();
    this.touchTimer = setTimeout(() => {
      this.touchTimer = null;
      this.clearHover();
    }, TOUCH_TOOLTIP_MS);
  }

  private clearTimer() {
    if (this.touchTimer !== null) {
      clearTimeout(this.touchTimer);
      this.touchTimer = null;
    }
  }

  private hit(x: number, y: number): Orb | null {
    // Canvas context was scaled by DPR, so use CSS pixel coordinates directly.
    // Reverse draw order, so the orb on top wins.
    for (let i = this.liveOrbs.length - 1; i >= 0; i--) {
      const orb = this.liveOrbs[i];
      if (orb.radius > 0 && Math.hypot(x - orb.x, y - orb.y) <= orb.radius) {
        return orb;
      }
    }
    return null;
  }
}
