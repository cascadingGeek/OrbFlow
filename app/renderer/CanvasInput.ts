import type { Orb, OrbChartConfig } from "../types/types";

const TOUCH_TOOLTIP_MS = 2500;

/** The pieces of config the input layer reads, looked up on every event. */
export type InputConfig = Pick<
  OrbChartConfig,
  "enableTooltip" | "onOrbClick" | "onOrbHover" | "width" | "height"
>;

/**
 * Owns every canvas listener and the tooltip. It hit tests, runs the touch
 * tooltip timer, and removes everything in `dispose()`.
 */
export class CanvasInput {
  private tooltip: HTMLDivElement | null = null;
  private liveOrbs: Orb[] = [];
  private hoveredOrb: Orb | null = null;
  private tooltipKey = "";
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
    private readonly container: HTMLElement,
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
    const enabled = Boolean(this.getConfig().enableTooltip);
    if (enabled && !this.tooltip) {
      this.tooltip = this.createTooltip();
    } else if (!enabled && this.tooltip) {
      this.tooltip.remove();
      this.tooltip = null;
      this.tooltipKey = "";
    }
  }

  /** Gives the orbs that can be hit, and clears a hover that went stale. */
  sync(liveOrbs: Orb[]) {
    this.liveOrbs = liveOrbs;
    if (!this.hoveredOrb) return;
    if (!liveOrbs.includes(this.hoveredOrb)) {
      this.clearHover();
    } else if (
      this.tooltip &&
      this.tooltipKey !== this.keyOf(this.hoveredOrb)
    ) {
      this.fillTooltip(this.hoveredOrb);
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
    this.tooltip?.remove();
    this.tooltip = null;
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
      this.showTooltip(orb, event.offsetX + 15, event.offsetY + 15, false);
    else this.hideTooltip();
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
      this.showTooltip(orb, x, y, true);
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
    this.hideTooltip();
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

  private keyOf(orb: Orb): string {
    return `${orb.label}\n${orb.value}\n${String(orb.metadata?.category ?? "")}`;
  }

  private showTooltip(orb: Orb, x: number, y: number, above: boolean) {
    const tip = this.tooltip;
    if (!tip) return;
    this.fillTooltip(orb);

    // Prevent tooltip clipping
    const { width, height } = this.getConfig();
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

    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
    tip.style.opacity = "1";
  }

  private fillTooltip(orb: Orb) {
    if (!this.tooltip) return;
    // Orb data is user supplied: set it as text, never as HTML.
    const lines = [
      this.line(orb.label, "font-weight: 600; margin-bottom: 2px;"),
      this.line(`Value: ${orb.value}`, "font-size: 12px; opacity: 0.8;"),
    ];
    if (orb.metadata?.category) {
      lines.push(
        this.line(
          String(orb.metadata.category),
          "font-size: 11px; opacity: 0.6; margin-top: 2px;",
        ),
      );
    }
    this.tooltip.replaceChildren(...lines);
    this.tooltipKey = this.keyOf(orb);
  }

  private hideTooltip() {
    if (this.tooltip) this.tooltip.style.opacity = "0";
  }

  private line(text: string, style: string): HTMLDivElement {
    const line = document.createElement("div");
    line.style.cssText = style;
    line.textContent = text;
    return line;
  }

  private createTooltip(): HTMLDivElement {
    const tip = document.createElement("div");
    tip.style.cssText = `
      position: absolute;
      background: rgba(15, 23, 42, 0.9);
      color: white;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 14px;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s;
      z-index: 1000;
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    `;
    this.container.style.position = "relative";
    this.container.appendChild(tip);
    return tip;
  }
}
