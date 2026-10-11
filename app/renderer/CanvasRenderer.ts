import { Orb, OrbChartConfig } from "../types/types";

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private container: HTMLElement;
  private imageCache: Map<string, HTMLImageElement> = new Map();
  private tooltipElement: HTMLDivElement | null = null;
  private config: OrbChartConfig;
  private hoveredOrb: Orb | null = null;
  private width: number = 0;
  private height: number = 0;
  private renderedOrbs: Orb[] = [];
  private onCanvasClick: ((x: number, y: number) => void) | null = null;

  constructor(container: HTMLElement, config: OrbChartConfig) {
    this.container = container;
    this.config = config;

    // Create canvas
    this.canvas = document.createElement("canvas");
    this.canvas.style.display = "block";
    this.canvas.style.cursor = "pointer";
    this.container.appendChild(this.canvas);

    const context = this.canvas.getContext("2d");
    if (!context) throw new Error("Could not get canvas context");
    this.ctx = context;

    if (this.config.enableTooltip) {
      this.createTooltip();
    }

    this.setupEventListeners();
  }

  updateConfig(config: OrbChartConfig) {
    this.config = config;
    if (this.config.enableTooltip && !this.tooltipElement) {
      this.createTooltip();
    } else if (!this.config.enableTooltip && this.tooltipElement) {
      this.tooltipElement.remove();
      this.tooltipElement = null;
    }
  }

  setCanvasClickHandler(handler: (x: number, y: number) => void) {
    this.onCanvasClick = handler;
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

  render(orbs: Orb[], elapsedTime: number = 0) {
    // Clear canvas
    this.ctx.fillStyle = this.config.backgroundColor || "#0a0e1a";
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Draw orbs with float effect
    orbs.forEach((orb, index) => {
      const floatAmp = this.config.floatAmplitude ?? 2.0;
      const floatSpd = this.config.floatSpeed ?? 0.002;
      const floatY = floatAmp * Math.sin(elapsedTime * floatSpd + index * 0.7);

      this.drawBubble(orb, 0, floatY);
    });
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
    if (!this.imageCache.has(url)) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => this.imageCache.set(url, img);
      img.onerror = () => console.warn(`Failed to load: ${url}`);
      img.src = url;
      this.imageCache.set(url, img);
    }
  }

  private createTooltip() {
    this.tooltipElement = document.createElement("div");
    this.tooltipElement.style.cssText = `
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
    this.container.appendChild(this.tooltipElement);
  }

  private setupEventListeners() {
    this.canvas.addEventListener("click", this.handleClick.bind(this));
    this.canvas.addEventListener("mousemove", this.handleMouseMove.bind(this));
    this.canvas.addEventListener(
      "mouseleave",
      this.handleMouseLeave.bind(this),
    );
  }

  setOrbs(orbs: Orb[]) {
    this.renderedOrbs = orbs;
  }

  private handleClick(event: MouseEvent) {
    if (this.onCanvasClick) {
      this.onCanvasClick(event.offsetX, event.offsetY);
    }

    const orb = this.getOrbAtPosition(event.offsetX, event.offsetY);
    if (orb && this.config.onOrbClick) {
      this.config.onOrbClick(orb, event);
    }
  }

  private handleMouseMove(event: MouseEvent) {
    const orb = this.getOrbAtPosition(event.offsetX, event.offsetY);

    if (orb !== this.hoveredOrb) {
      this.hoveredOrb = orb;
      if (this.config.onOrbHover) {
        this.config.onOrbHover(orb);
      }
    }

    if (this.tooltipElement && this.config.enableTooltip) {
      if (orb) {
        this.tooltipElement.innerHTML = `
          <div style="font-weight: 600; margin-bottom: 2px;">${orb.label}</div>
          <div style="font-size: 12px; opacity: 0.8;">Value: ${orb.value}</div>
          ${orb.metadata?.category ? `<div style="font-size: 11px; opacity: 0.6; margin-top: 2px;">${orb.metadata.category}</div>` : ""}
        `;

        // Prevent tooltip clipping
        const tipRect = this.tooltipElement.getBoundingClientRect();
        let left = event.offsetX + 15;
        let top = event.offsetY + 15;

        if (left + tipRect.width > this.width) left -= tipRect.width + 20;
        if (top + tipRect.height > this.height) top -= tipRect.height + 20;

        this.tooltipElement.style.left = `${left}px`;
        this.tooltipElement.style.top = `${top}px`;
        this.tooltipElement.style.opacity = "1";
      } else {
        this.tooltipElement.style.opacity = "0";
      }
    }
  }

  private handleMouseLeave() {
    this.hoveredOrb = null;
    if (this.tooltipElement) {
      this.tooltipElement.style.opacity = "0";
    }
    if (this.config.onOrbHover) {
      this.config.onOrbHover(null);
    }
  }

  private getOrbAtPosition(x: number, y: number): Orb | null {
    // Canvas context was scaled by DPR, so use CSS pixel coordinates directly
    for (const orb of this.renderedOrbs) {
      const dx = x - orb.x;
      const dy = y - orb.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= orb.radius) {
        return orb;
      }
    }
    return null;
  }

  destroy() {
    if (this.tooltipElement) {
      this.tooltipElement.remove();
    }
    this.canvas.remove();
    this.imageCache.clear();
  }
}
