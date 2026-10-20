import { Orb, OrbChartConfig } from "../types/types";

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  // Only images that finished loading; drawImage throws on a broken image.
  private imageCache: Map<string, HTMLImageElement> = new Map();
  // Every URL ever requested, so a slow or broken one is fetched only once.
  private requestedImages: Set<string> = new Set();
  // Images still loading, so destroy() can silence their callbacks.
  private pendingImages: Set<HTMLImageElement> = new Set();
  private config: OrbChartConfig;
  private width: number = 0;
  private height: number = 0;
  // Still mode draws no float wobble; the focus ring follows the same offset.
  private still = false;
  private focusedId: string | null = null;

  /** `onImageLoaded` lets an idle chart draw once when an image arrives. */
  constructor(
    container: HTMLElement,
    config: OrbChartConfig,
    private readonly onImageLoaded: () => void = () => {},
  ) {
    this.config = config;

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
    this.canvas.style.cursor = "pointer";
    container.appendChild(this.canvas);
  }

  /** The canvas this renderer draws on, for the input layer to listen to. */
  get element(): HTMLCanvasElement {
    return this.canvas;
  }

  updateConfig(config: OrbChartConfig) {
    this.config = config;
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

  render(
    orbs: Orb[],
    elapsedTime: number = 0,
    phaseOf: (orb: Orb) => number = () => 0,
  ) {
    // Clear canvas
    this.ctx.fillStyle = this.config.backgroundColor || "#0a0e1a";
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Draw orbs with float effect
    orbs.forEach((orb) => {
      this.drawBubble(orb, 0, this.floatOffset(elapsedTime, phaseOf(orb)));
    });

    // The ring goes last, so it sits on top of every orb.
    const focused = orbs.find((orb) => orb.id === this.focusedId);
    if (focused) {
      const { x, y } = this.centerOf(focused, elapsedTime, phaseOf(focused));
      this.drawFocusRing(x, y, focused.radius);
    }
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

  private drawBubble(orb: Orb, floatX: number, floatY: number) {
    const x = orb.x + floatX;
    const y = orb.y + floatY;
    const r = orb.radius;

    // 1. Base Bubble Fill (semi-transparent)
    this.ctx.beginPath();
    this.ctx.arc(x, y, r, 0, Math.PI * 2);

    const fillGradient = this.ctx.createRadialGradient(
      x - r * 0.3,
      y - r * 0.3,
      r * 0.1,
      x,
      y,
      r,
    );

    fillGradient.addColorStop(0, this.hexToRgba(orb.color || "#3b82f6", 0.4));
    fillGradient.addColorStop(1, this.hexToRgba(orb.color || "#3b82f6", 0.1));

    this.ctx.fillStyle = fillGradient;
    this.ctx.fill();

    // 2. Inner Rim/Glow
    this.ctx.beginPath();
    this.ctx.arc(x, y, r * 0.9, 0, Math.PI * 2);
    this.ctx.strokeStyle = this.hexToRgba(orb.color || "#3b82f6", 0.3);
    this.ctx.lineWidth = 1;
    this.ctx.stroke();

    // 3. Specular Highlight (The "shiny" part)
    this.ctx.beginPath();
    this.ctx.ellipse(
      x - r * 0.3,
      y - r * 0.4,
      r * 0.3,
      r * 0.15,
      -Math.PI / 4,
      0,
      Math.PI * 2,
    );
    this.ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    this.ctx.fill();

    // 4. Bottom Reflection
    this.ctx.beginPath();
    this.ctx.arc(x, y, r * 0.85, 0.2 * Math.PI, 0.8 * Math.PI);
    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    // 5. Draw image if available
    const img = orb.imageUrl ? this.imageCache.get(orb.imageUrl) : undefined;
    if (img) {
      const imgSize = r * 0.8;

      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(x, y, imgSize / 2, 0, Math.PI * 2);
      this.ctx.clip();
      this.ctx.globalAlpha = 0.9;
      this.ctx.drawImage(
        img,
        x - imgSize / 2,
        y - imgSize / 2,
        imgSize,
        imgSize,
      );
      this.ctx.restore();
    } else if (orb.imageUrl) {
      this.loadImage(orb.imageUrl);
    }

    // 6. Draw label
    this.ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    this.ctx.font = `bold ${Math.max(11, r / 4)}px Inter, sans-serif`;
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";

    const labelY = orb.imageUrl ? y + r * 0.5 : y;
    this.ctx.fillText(orb.label, x, labelY);

    // Value below label
    this.ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    this.ctx.font = `${Math.max(10, r / 5)}px Inter, sans-serif`;
    this.ctx.fillText(orb.value + "%", x, labelY + r * 0.25);
  }

  private hexToRgba(hex: string, alpha: number): string {
    let r = 0,
      g = 0,
      b = 0;
    if (hex.length === 4) {
      r = parseInt(hex[1] + hex[1], 16);
      g = parseInt(hex[2] + hex[2], 16);
      b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
      r = parseInt(hex.substring(1, 3), 16);
      g = parseInt(hex.substring(3, 5), 16);
      b = parseInt(hex.substring(5, 7), 16);
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  preloadImages(orbs: Orb[]) {
    orbs.forEach((orb) => {
      if (orb.imageUrl) {
        this.loadImage(orb.imageUrl);
      }
    });
  }

  private loadImage(url: string) {
    if (this.requestedImages.has(url)) return;
    this.requestedImages.add(url);

    const img = new Image();
    img.crossOrigin = "anonymous";
    this.pendingImages.add(img);
    img.onload = () => {
      this.pendingImages.delete(img);
      this.imageCache.set(url, img);
      this.onImageLoaded();
    };
    img.onerror = () => {
      this.pendingImages.delete(img);
      console.warn(`Failed to load: ${url}`);
    };
    img.src = url;
  }

  destroy() {
    for (const img of this.pendingImages) {
      img.onload = null;
      img.onerror = null;
    }
    this.pendingImages.clear();
    this.canvas.remove();
    this.imageCache.clear();
    this.requestedImages.clear();
  }
}
