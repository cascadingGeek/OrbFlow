import { PhysicsEngine } from "./physics";
import { CanvasRenderer } from "../renderer/CanvasRenderer";
import type {
  Orb,
  OrbChartConfig,
  OrbDataInput,
  PhysicsConfig,
} from "../types/types";

/**
 * Main OrbChart class - framework agnostic with bubble styling
 */
export class OrbChart {
  private container: HTMLElement;
  private physicsEngine: PhysicsEngine;
  private renderer: CanvasRenderer;
  private orbs: Orb[] = [];
  private animationFrameId: number | null = null;
  private isPlaying: boolean = true;
  private startTime: number = Date.now();

  private config: Required<Omit<OrbChartConfig, keyof PhysicsConfig>> &
    PhysicsConfig;

  // Cool color palette (Blues, Cyans, Purples)
  private readonly defaultColors = [
    "#3b82f6", // blue-500
    "#06b6d4", // cyan-500
    "#8b5cf6", // violet-500
    "#6366f1", // indigo-500
    "#0ea5e9", // sky-500
    "#a855f7", // purple-500
    "#22d3ee", // cyan-400
    "#818cf8", // indigo-400
  ];

  constructor(container: HTMLElement | string, config: OrbChartConfig = {}) {
    // Get container element
    if (typeof container === "string") {
      const el = document.querySelector(container);
      if (!el) throw new Error(`Container "${container}" not found`);
      this.container = el as HTMLElement;
    } else {
      this.container = container;
    }

    // Setup config with defaults - smaller bubbles
    this.config = {
      width: config.width ?? this.container.clientWidth,
      height: config.height ?? this.container.clientHeight,
      backgroundColor: config.backgroundColor ?? "#0a0e1a",
      minRadius: config.minRadius ?? 25,
      maxRadius: config.maxRadius ?? 80,
      colorScheme: config.colorScheme ?? this.defaultColors,
      enableTooltip: config.enableTooltip ?? true,
      onOrbClick: config.onOrbClick ?? (() => {}),
      onOrbHover: config.onOrbHover ?? (() => {}),
      damping: config.damping,
      minVelocity: config.minVelocity,
      bounceCoefficient: config.bounceCoefficient,
      floatAmplitude: config.floatAmplitude ?? 2.0,
      floatSpeed: config.floatSpeed ?? 0.002,
    };

    // Initialize Renderer
    this.renderer = new CanvasRenderer(this.container, this.config);

    // Setup mouse repulsion handler
    this.renderer.setCanvasClickHandler((x, y) => {
      this.physicsEngine.applyMouseRepulsion(x, y, 150);
    });

    // Initialize physics engine
    this.physicsEngine = new PhysicsEngine(
      this.config.width,
      this.config.height,
      this.config,
    );

    // Setup event listeners
    this.handleResize();

    // Setup resize observer
    const resizeObserver = new ResizeObserver(() => this.handleResize());
    resizeObserver.observe(this.container);
  }

  /**
   * Load data and initialize orbs
   */
  setData(data: OrbDataInput[]) {
    if (!data || data.length === 0) {
      this.orbs = [];
      return;
    }

    // Calculate min/max values for radius scaling
    const values = data.map((d) => d.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);

    // Create orbs with random initial positions
    this.orbs = data.map((item, index) => {
      const normalizedValue =
        (item.value - minValue) / (maxValue - minValue || 1);
      // Linear scaling directly proportional to value
      const radius =
        this.config.minRadius +
        normalizedValue * (this.config.maxRadius - this.config.minRadius);

      return {
        id: item.id,
        label: item.label,
        value: item.value,
        radius,
        x: Math.random() * (this.config.width - radius * 2) + radius,
        y: Math.random() * (this.config.height - radius * 2) + radius,
        vx: (Math.random() - 0.5) * 1,
        vy: (Math.random() - 0.5) * 1,
        color:
          item.color ??
          this.config.colorScheme[index % this.config.colorScheme.length],
        imageUrl: item.imageUrl,
        metadata: item.metadata,
      };
    });

    // Preload images in renderer
    this.renderer.preloadImages(this.orbs);

    // Start animation if playing
    if (this.isPlaying) {
      this.start();
    }
  }

  private handleResize() {
    const rect = this.container.getBoundingClientRect();

    // Ensure we have dimensions
    if (rect.width === 0 || rect.height === 0) return;

    this.config.width = rect.width;
    this.config.height = rect.height;

    this.renderer.updateDimensions(rect.width, rect.height);
    this.physicsEngine.updateDimensions(rect.width, rect.height);
  }

  private render() {
    // Update physics
    if (this.isPlaying) {
      this.orbs = this.physicsEngine.update(this.orbs);
    }

    const elapsed = Date.now() - this.startTime;

    // Pass latest orbs to renderer
    this.renderer.setOrbs(this.orbs);
    this.renderer.render(this.orbs, elapsed);

    // Continue animation
    if (this.isPlaying) {
      this.animationFrameId = requestAnimationFrame(() => this.render());
    }
  }

  /**
   * Start/resume animation
   */
  start() {
    if (!this.isPlaying) {
      this.isPlaying = true;
      this.render();
    } else if (this.animationFrameId === null) {
      // Was initialized but not running
      this.render();
    }
  }

  /**
   * Pause animation
   */
  pause() {
    this.isPlaying = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Destroy chart instance
   */
  destroy() {
    this.pause();
    this.renderer.destroy();
    this.orbs = [];
  }

  /**
   * Get current orbs data
   */
  getData(): Orb[] {
    return [...this.orbs];
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<OrbChartConfig>) {
    this.config = { ...this.config, ...config };
    this.renderer.updateConfig(this.config);
    if (config.width !== undefined || config.height !== undefined) {
      this.handleResize();
    }
  }
}
