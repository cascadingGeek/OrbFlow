import { PhysicsEngine } from "./physics";
import { CanvasRenderer } from "../renderer/CanvasRenderer";
import { CanvasInput } from "../renderer/CanvasInput";
import { AnimationLoop } from "./AnimationLoop";
import { ConfigResolver, type ResolvedConfig } from "./ConfigResolver";
import { DataValidator } from "./DataValidator";
import { OrbReconciler } from "./OrbReconciler";
import { RadiusTweener } from "./RadiusTweener";
import type {
  Orb,
  OrbChartConfig,
  OrbDataInput,
  OrbDataIssue,
} from "../types/types";

/**
 * Main OrbChart class - framework agnostic with bubble styling
 */
export class OrbChart {
  private container: HTMLElement;
  private physicsEngine!: PhysicsEngine;
  private renderer!: CanvasRenderer;
  private input!: CanvasInput;
  private loop: AnimationLoop;
  private tweener: RadiusTweener;
  private reconciler: OrbReconciler;
  private validator = new DataValidator();
  private resolver = new ConfigResolver();
  private orbs: Orb[] = [];
  private startTime: number;
  private destroyed = false;
  // Undo steps in the order resources were created; run in reverse.
  private teardown: (() => void)[] = [];
  private config: ResolvedConfig;

  constructor(container: HTMLElement | string, config: OrbChartConfig = {}) {
    // Get container element
    if (typeof container === "string") {
      const el = document.querySelector(container);
      if (!el) throw new Error(`Container "${container}" not found`);
      this.container = el as HTMLElement;
    } else {
      this.container = container;
    }

    this.config = this.resolver.resolve(config, {
      width: this.container.clientWidth,
      height: this.container.clientHeight,
    });
    this.loop = new AnimationLoop((now) => this.frame(now));
    this.startTime = this.loop.now();
    this.reconciler = new OrbReconciler(
      (this.tweener = new RadiusTweener((orb) =>
        this.reconciler.forget(orb.id),
      )),
    );

    try {
      this.mount();
    } catch (error) {
      this.runTeardown();
      throw error;
    }
  }

  private mount() {
    this.renderer = new CanvasRenderer(this.container, this.config);
    this.teardown.push(() => this.renderer.destroy());

    this.input = new CanvasInput(
      this.renderer.element,
      this.container,
      () => this.config,
      (x, y) => this.physicsEngine.applyMouseRepulsion(this.orbs, x, y, 150),
    );
    this.teardown.push(() => this.input.dispose());

    this.physicsEngine = new PhysicsEngine(
      this.config.width,
      this.config.height,
      this.config,
    );

    const resizeObserver = new ResizeObserver(() => this.handleResize());
    this.teardown.push(() => resizeObserver.disconnect());
    resizeObserver.observe(this.container);

    this.handleResize();
  }

  /**
   * Load data. Orbs are matched by `id`: existing ones keep their place and
   * animate to their new size, new ones grow in, missing ones shrink out. Bad
   * entries are skipped and reported, never thrown.
   */
  setData(data: OrbDataInput[]) {
    if (this.destroyed) return;

    const { accepted, issues, notArray } = this.validator.validate(data);
    if (notArray) console.warn("OrbFlow: setData expects an array, got none.");

    const now = this.loop.now();
    this.orbs = this.reconciler.reconcile(
      this.orbs,
      accepted,
      this.config,
      now,
    );
    this.settle(now);
    this.renderer.preloadImages(this.orbs);
    this.loop.start();
    this.reportIssues(issues);
  }

  private reportIssues(issues: OrbDataIssue[]) {
    if (issues.length === 0) return;
    console.warn(
      `OrbFlow: skipped ${issues.length} invalid data ${
        issues.length === 1 ? "entry" : "entries"
      }.`,
      issues,
    );
    try {
      this.config.onDataIssue(issues);
    } catch (error) {
      console.error("OrbFlow: onDataIssue handler threw.", error);
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
    this.reconciler.placeAwaiting(rect.width, rect.height);
  }

  /** Advances tweens, drops exited orbs, and clears a stale hover. */
  private settle(now: number) {
    this.orbs = this.tweener.step(this.orbs, now);
    this.input.sync(this.orbs.filter((orb) => !this.tweener.isExiting(orb)));
  }

  private draw(now: number) {
    this.renderer.render(this.orbs, now - this.startTime, (orb) =>
      this.reconciler.phaseOf(orb),
    );
  }

  private frame(now: number) {
    this.settle(now);
    this.orbs = this.physicsEngine.update(this.orbs);
    this.draw(now);
  }

  /**
   * Start/resume animation
   */
  start() {
    if (this.destroyed) return;
    this.loop.start();
  }

  /**
   * Pause animation
   */
  pause() {
    if (this.destroyed) return;
    this.loop.stop();
  }

  /**
   * Destroy chart instance. Safe to call more than once.
   */
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.loop.stop();
    this.runTeardown();
    this.orbs = [];
  }

  private runTeardown() {
    while (this.teardown.length > 0) this.teardown.pop()?.();
  }

  /**
   * Get current orbs data, without orbs that are shrinking out
   */
  getData(): Orb[] {
    return this.orbs.filter((orb) => !this.tweener.isExiting(orb));
  }

  /**
   * Update configuration. Keys set to `undefined` are ignored.
   */
  updateConfig(config: Partial<OrbChartConfig>) {
    if (this.destroyed) return;
    const previous = this.config;
    this.config = this.resolver.merge(previous, config);
    this.renderer.updateConfig(this.config);
    this.input.refresh();
    if (config.width !== undefined || config.height !== undefined) {
      this.handleResize();
    }

    if (
      this.config.minRadius !== previous.minRadius ||
      this.config.maxRadius !== previous.maxRadius
    ) {
      // A paused chart cannot animate, so it jumps and draws once.
      const duration = this.loop.playing ? this.config.transitionDuration : 0;
      const now = this.loop.now();
      this.reconciler.retargetAll(this.orbs, this.config, now, duration);
      this.settle(now);
      if (!this.loop.playing) this.draw(now);
    }
  }
}
