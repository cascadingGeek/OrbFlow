import { PhysicsEngine } from "./physics";
import { ChartView } from "../renderer/ChartView";
import { AnimationLoop } from "./AnimationLoop";
import { Playback } from "./Playback";
import { reportIssues } from "./reportIssues";
import { ConfigResolver, type ResolvedConfig } from "./ConfigResolver";
import { DataValidator } from "./DataValidator";
import { OrbReconciler } from "./OrbReconciler";
import { RadiusTweener } from "./RadiusTweener";
import { MotionPreference } from "./MotionPreference";
import { Settler } from "./Settler";
import { Redrawer } from "./Redrawer";
import { Teardown } from "./Teardown";
import { resolveContainer } from "./resolveContainer";
import type { Orb, OrbChartConfig, OrbDataInput } from "../types/types";

/**
 * Main OrbChart class - framework agnostic with bubble styling
 */
export class OrbChart {
  private container: HTMLElement;
  private physicsEngine!: PhysicsEngine;
  private view!: ChartView;
  private motion!: MotionPreference;
  private redrawer!: Redrawer;
  private loop: AnimationLoop;
  private playback: Playback;
  private tweener: RadiusTweener;
  private reconciler: OrbReconciler;
  private validator = new DataValidator();
  private resolver = new ConfigResolver();
  private orbs: Orb[] = [];
  private startTime: number;
  private destroyed = false;
  private teardown = new Teardown();
  private config: ResolvedConfig;

  constructor(container: HTMLElement | string, config: OrbChartConfig = {}) {
    this.container = resolveContainer(container);

    this.config = this.resolver.resolve(config, {
      width: this.container.clientWidth,
      height: this.container.clientHeight,
    });
    this.loop = new AnimationLoop((now) => this.frame(now));
    this.playback = new Playback(this.loop);
    this.startTime = this.loop.now();
    this.reconciler = new OrbReconciler(
      (this.tweener = new RadiusTweener((orb) =>
        this.reconciler.forget(orb.id),
      )),
    );

    try {
      this.mount();
    } catch (error) {
      this.teardown.run();
      throw error;
    }
  }

  private mount() {
    this.view = new ChartView(this.container, () => this.config, {
      onCanvasClick: (x, y) => {
        if (this.playback.reduced) return;
        this.physicsEngine.applyMouseRepulsion(this.orbs, x, y, 150);
      },
      onImageLoaded: () => {
        if (this.playback.idle) this.redrawer.run(false);
      },
      elapsed: () => this.loop.now() - this.startTime,
      phaseOf: (orb) => this.reconciler.phaseOf(orb),
      onResize: () => this.handleResize(),
      redrawIfStopped: () => {
        if (!this.loop.playing) this.draw(this.loop.now());
      },
    });
    this.teardown.add(() => this.view.dispose());

    this.physicsEngine = new PhysicsEngine(
      this.config.width,
      this.config.height,
      this.config,
    );
    const settler = new Settler(this.physicsEngine);
    this.redrawer = new Redrawer(this.playback, {
      now: () => this.loop.now(),
      sized: () => this.config.width > 0 && this.config.height > 0,
      snap: () => this.sync(Infinity),
      settleOrbs: () => settler.settle(this.orbs),
      draw: (now) => this.draw(now),
      setStill: (still) => this.view.setStill(still),
    });
    this.motion = new MotionPreference(this.config.reducedMotion, (reduced) =>
      this.redrawer.flipped(reduced),
    );
    this.teardown.add(() => this.motion.dispose());
    this.redrawer.apply(this.motion.reduced);
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

    // A paused or still chart jumps to the new data and draws one frame.
    const now = this.loop.now();
    const duration = this.playback.idle ? 0 : undefined;
    this.orbs = this.reconciler.reconcile(
      this.orbs,
      accepted,
      this.config,
      now,
      duration,
    );
    this.sync(now);
    this.view.syncList(this.getData());
    this.view.preloadImages(this.orbs);
    if (this.playback.idle) this.redrawer.run();
    this.playback.autoStart();
    reportIssues(issues, this.config.onDataIssue);
  }

  private handleResize() {
    const rect = this.container.getBoundingClientRect();

    // Ensure we have dimensions
    if (rect.width === 0 || rect.height === 0) return;

    this.config.width = rect.width;
    this.config.height = rect.height;

    this.view.resize(rect.width, rect.height);
    this.physicsEngine.updateDimensions(rect.width, rect.height);
    this.reconciler.placeAwaiting(rect.width, rect.height);
    // Resizing clears the canvas, so an idle chart repaints once.
    if (this.playback.idle) this.redrawer.run();
  }

  /** Advances tweens, drops exited orbs, and clears a stale hover. */
  private sync(now: number) {
    this.orbs = this.tweener.step(this.orbs, now);
    this.view.syncInput(this.getData());
  }

  private draw(now: number) {
    this.view.render(this.orbs, now - this.startTime);
  }

  private frame(now: number) {
    this.sync(now);
    this.orbs = this.physicsEngine.update(this.orbs);
    this.draw(now);
  }

  /** Start or resume animation. */
  start() {
    if (this.destroyed) return;
    this.playback.start();
    this.redrawer.begin();
  }

  /** Pause animation. */
  pause() {
    if (this.destroyed) return;
    this.playback.pause();
  }

  /** Destroy chart instance. Safe to call more than once. */
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.playback.stop();
    this.teardown.run();
    this.orbs = [];
  }

  /** Get current orbs data, without orbs that are shrinking out. */
  getData(): Orb[] {
    return this.orbs.filter((orb) => !this.tweener.isExiting(orb));
  }

  /** Update configuration. Keys set to `undefined` are ignored. */
  updateConfig(config: Partial<OrbChartConfig>) {
    if (this.destroyed) return;
    const previous = this.config;
    this.config = this.resolver.merge(previous, config);
    this.view.updateConfig(this.config);
    this.motion.setSetting(this.config.reducedMotion);
    if (config.width !== undefined || config.height !== undefined) {
      this.handleResize();
    }

    const now = this.loop.now();
    const radiiChanged =
      this.config.minRadius !== previous.minRadius ||
      this.config.maxRadius !== previous.maxRadius;
    if (radiiChanged) {
      // A stopped chart cannot animate, so it jumps.
      const duration = this.loop.playing ? this.config.transitionDuration : 0;
      this.reconciler.retargetAll(this.orbs, this.config, now, duration);
      this.sync(now);
    }
    // Nothing else will paint a stopped chart, so draw one frame.
    if (this.playback.idle || (radiiChanged && !this.loop.playing)) {
      this.redrawer.run(radiiChanged);
    }
  }
}
