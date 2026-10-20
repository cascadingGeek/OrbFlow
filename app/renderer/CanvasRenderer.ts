import type { Orb, OrbChartConfig } from "../types/types";
import { BubblePainter, type Look } from "./BubblePainter";
import { BurstEffects } from "./BurstEffects";
import { ImageCache } from "./ImageCache";
import { resolveTheme } from "./color";

/** The parts a renderer draws with. Each one is optional for tests. */
export interface RendererParts {
  images?: ImageCache;
  painter?: BubblePainter;
  effects?: BurstEffects;
}

/** The clock readings for one frame. */
export interface FrameTime {
  /** Loop clock time, for bursts and ghosts. */
  now: number;
  /** Milliseconds since the chart started, for the float and the film. */
  elapsed: number;
  /** False while paused or still: the film holds at its start angle. */
  moving: boolean;
}

const FILM_START = (200 * Math.PI) / 180;
const FILM_TURN_MS = 14000;

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private config!: OrbChartConfig;
  private theme: Look["theme"] = "dark";
  private readonly images: ImageCache;
  private readonly painter: BubblePainter;
  private readonly effects: BurstEffects;
  private width: number = 0;
  private height: number = 0;
  // Still mode draws no float wobble; the focus ring follows the same offset.
  private still = false;
  private focusedId: string | null = null;

  /** The parts are owned by the caller, which disposes them. */
  constructor(
    container: HTMLElement,
    config: OrbChartConfig,
    parts: RendererParts = {},
  ) {
    this.painter = parts.painter ?? new BubblePainter();
    this.images = parts.images ?? new ImageCache();
    this.effects = parts.effects ?? new BurstEffects(this.painter);
    this.updateConfig(config);

    // Check the context before the canvas touches the container, so a
    // failure leaves nothing behind.
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not get canvas context");
    this.canvas = canvas;
    this.ctx = context;

    // The accessible list carries the same facts, so hide the canvas.
    this.canvas.setAttribute("aria-hidden", "true");
    this.canvas.style.display = "block";
    this.canvas.style.cursor = "default";
    container.appendChild(this.canvas);
  }

  /** The canvas this renderer draws on, for the input layer to listen to. */
  get element(): HTMLCanvasElement {
    return this.canvas;
  }

  /** Applies new options; the theme is resolved here, not every frame. */
  updateConfig(config: OrbChartConfig) {
    this.config = config;
    this.theme = resolveTheme(config.theme, config.backgroundColor);
  }

  /** Turns the float wobble off (true) or back on. */
  setStill(still: boolean) {
    this.still = still;
  }

  /** The orb that gets the focus ring, or `null` for none. */
  setFocus(id: string | null) {
    this.focusedId = id;
  }

  /** Where `orb` is drawn: its position plus the current float offset. */
  centerOf(orb: Orb, elapsedTime: number, phase: number) {
    return { x: orb.x, y: orb.y + this.floatOffset(elapsedTime, phase) };
  }

  private floatOffset(elapsedTime: number, phase: number): number {
    if (this.still) return 0;
    const floatAmp = this.config.floatAmplitude ?? 2.0;
    const floatSpd = this.config.floatSpeed ?? 0.002;
    return floatAmp * Math.sin(elapsedTime * floatSpd + phase);
  }

  updateDimensions(width: number, height: number) {
    const dpr = window.devicePixelRatio || 1;
    this.width = width;
    this.height = height;

    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    this.ctx.scale(dpr, dpr);
  }

  /** Draws background, ghosts, bubbles, bursts, then the focus ring. */
  render(
    orbs: Orb[],
    time: FrameTime = { now: 0, elapsed: 0, moving: false },
    phaseOf: (orb: Orb) => number = () => 0,
  ) {
    const { ctx } = this;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.fillStyle = this.config.backgroundColor || "#0a0e1a";
    ctx.fillRect(0, 0, this.width, this.height);

    const turning = time.moving && !this.still;
    const look: Look = {
      theme: this.theme,
      fontFamily: this.config.fontFamily || "Inter, system-ui, sans-serif",
      filmAngle:
        FILM_START +
        (turning ? (time.elapsed * 2 * Math.PI) / FILM_TURN_MS : 0),
    };
    this.effects.drawGhosts(ctx, time.now, look);
    for (const orb of orbs) {
      this.painter.paint(ctx, this.bubbleOf(orb, time.elapsed, phaseOf), look);
    }
    this.effects.drawBursts(ctx, time.now, look);

    // The ring goes last, so it sits on top of everything.
    const focused = orbs.find((orb) => orb.id === this.focusedId);
    if (focused) {
      const { x, y } = this.centerOf(focused, time.elapsed, phaseOf(focused));
      this.drawFocusRing(x, y, focused.radius);
    }
  }

  /** What `orb` looks like right now, for drawing or for a pop snapshot. */
  bubbleOf(orb: Orb, elapsed: number, phaseOf: (orb: Orb) => number) {
    const { x, y } = this.centerOf(orb, elapsed, phaseOf(orb));
    return {
      x,
      y,
      r: orb.radius,
      color: orb.color,
      label: orb.label,
      value: orb.value,
      image: this.images.get(orb.imageUrl),
    };
  }

  // Two tones, so the ring shows on any background.
  private drawFocusRing(x: number, y: number, r: number) {
    this.ctx.lineWidth = 2;
    for (const [offset, color] of [
      [3, "#0a0e1a"],
      [5, "#ffffff"],
    ] as const) {
      this.ctx.beginPath();
      this.ctx.arc(x, y, r + offset, 0, Math.PI * 2);
      this.ctx.strokeStyle = color;
      this.ctx.stroke();
    }
  }

  /** Removes the canvas. */
  destroy() {
    this.canvas.remove();
  }
}
