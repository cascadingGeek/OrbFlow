import type { Orb, OrbChartConfig, OrbDataInput } from "../types/types";
import { ChartView } from "../renderer/ChartView";
import { ConfigResolver, type ResolvedConfig } from "./config/ConfigResolver";
import { DataValidator } from "./config/DataValidator";
import { reportIssues } from "./config/reportIssues";
import { Teardown } from "./lifecycle/Teardown";
import { resolveContainer } from "./lifecycle/resolveContainer";
import { OrbReconciler } from "./orbs/OrbReconciler";
import { RadiusTweener } from "./orbs/RadiusTweener";
import { RiseTracker } from "./orbs/RiseTracker";
import { PhysicsEngine } from "./physics/PhysicsEngine";
import { Settler } from "./physics/Settler";
import { AnimationLoop } from "./playback/AnimationLoop";
import { MotionPreference } from "./playback/MotionPreference";
import { Playback } from "./playback/Playback";
import { Redrawer } from "./playback/Redrawer";
import { ChartPopHost } from "./pop/ChartPopHost";
import { PopController } from "./pop/PopController";
import { PopLedger } from "./pop/PopLedger";

/** The chart, framework agnostic. */
export class OrbChart {
  private container: HTMLElement;
  private physicsEngine!: PhysicsEngine;
  private view!: ChartView;
  private motion!: MotionPreference;
  private redrawer!: Redrawer;
  private pops!: PopController;
  private loop: AnimationLoop;
  private playback: Playback;
  private tweener: RadiusTweener;
  private reconciler: OrbReconciler;
  private rises: RiseTracker;
  private ledger = new PopLedger();
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
    this.rises = new RiseTracker({
      config: () => this.config,
      idle: () => this.playback.idle,
      gateOpen: () => this.view.gateOpen,
      openGate: () => this.view.openGate(),
    });
    this.reconciler = new OrbReconciler(
      (this.tweener = new RadiusTweener((orb) => {
        this.reconciler.forget(orb.id);
        this.rises.forget(orb.id);
      })),
      Math.random,
      () => this.ledger.all(),
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
      onCanvasMiss: (x, y) => {
        if (this.playback.reduced) return;
        this.physicsEngine.applyMouseRepulsion(this.orbs, x, y, 150);
      },
      onActivate: (orb, event) => this.pops.activate(orb, event),
      onImageLoaded: () => {
        if (this.playback.idle) this.redrawer.run(false);
      },
      now: () => this.loop.now(),
      elapsed: () => this.loop.now() - this.startTime,
      phaseOf: (orb) => this.reconciler.phaseOf(orb),
      riseOf: (orb, now) => this.rises.offsetOf(orb, now, this.config.height),
      onGateOpen: () => this.rises.release(this.loop.now()),
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
      setStill: (still) => {
        // A still chart shows only end states, so rises finish first.
        if (still) this.rises.finishAll();
        this.view.setStill(still);
      },
    });
    this.motion = new MotionPreference(this.config.reducedMotion, (reduced) =>
      this.redrawer.flipped(reduced),
    );
    this.teardown.add(() => this.motion.dispose());
    this.pops = new PopController(
      new ChartPopHost({
        view: this.view,
        physics: this.physicsEngine,
        reconciler: this.reconciler,
        rises: this.rises,
        ledger: this.ledger,
        orbs: {
          all: () => this.orbs,
          set: (orbs) => (this.orbs = orbs),
          live: () => this.getData(),
        },
        config: () => this.config,
        now: () => this.loop.now(),
        playback: this.playback,
        redraw: (settle) => this.redrawer.run(settle),
      }),
    );
    this.redrawer.apply(this.motion.reduced);
    this.handleResize();
  }

  /**
   * Loads data, matching orbs by `id`: new ones enter, missing ones shrink out.
   * Bad entries are skipped and reported, and popped bubbles are forgotten.
   */
  setData(data: OrbDataInput[]) {
    if (this.destroyed) return;

    const { accepted, issues, notArray } = this.validator.validate(data);
    if (notArray) console.warn("OrbFlow: setData expects an array, got none.");
    // Data is the truth: ghosts and popped records go.
    this.view.clearGhosts();
    this.ledger.clear();

    // A paused or still chart jumps to the new data and draws one frame.
    const now = this.loop.now();
    const duration = this.playback.idle ? 0 : undefined;
    const known = new Set(this.orbs.map((orb) => orb.id));
    this.orbs = this.reconciler.reconcile(
      this.orbs,
      accepted,
      this.config,
      now,
      duration,
    );
    this.rises.enter(this.orbs, known, now);
    this.sync(now);
    this.view.syncList(this.getData());
    this.view.preloadImages(this.orbs);
    if (this.playback.idle) this.redrawer.run();
    this.playback.autoStart();
    reportIssues(issues, this.config.onDataIssue);
  }

  private handleResize() {
    const rect = this.container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    this.config.width = rect.width;
    this.config.height = rect.height;

    this.view.resize(rect.width, rect.height);
    this.physicsEngine.updateDimensions(rect.width, rect.height);
    this.reconciler.placeAwaiting(rect.width, rect.height);
    // Resizing clears the canvas, so an idle chart repaints once.
    if (this.playback.idle) this.redrawer.run();
  }

  /** Advances tweens and rises, drops exited orbs, and clears a stale hover. */
  private sync(now: number) {
    this.orbs = this.tweener.step(this.orbs, now);
    this.rises.step(now);
    this.view.syncInput(this.getData());
  }

  private draw(now: number) {
    const elapsed = now - this.startTime;
    this.view.render(this.orbs, { now, elapsed, moving: !this.playback.idle });
  }

  private frame(now: number) {
    this.sync(now);
    this.orbs = this.physicsEngine.update(this.orbs);
    this.draw(now);
  }

  start() {
    if (this.destroyed) return;
    this.playback.start();
    this.redrawer.begin();
  }

  /** Pause animation. Bursts and rises in flight jump to their end. */
  pause() {
    if (this.destroyed) return;
    this.playback.pause();
    const risen = this.rises.finishAll();
    if (this.view.finishBursts(this.loop.now()) || risen) {
      this.redrawer.run(false);
    }
  }

  /**
   * Pops the live bubble `id` into droplets and runs `onOrbPop`. Returns false
   * for an unknown, popped, or exiting id, or after `destroy()`.
   */
  pop(id: string): boolean {
    return !this.destroyed && this.pops.pop(id);
  }

  /**
   * Brings back the popped bubble `id`, or all popped bubbles without an
   * `id`; each rises to its old place. Call it when your drawer closes.
   * Returns false when nothing came back (unknown or live id, or destroyed).
   */
  restore(id?: string): boolean {
    return !this.destroyed && this.pops.restore(id);
  }

  /** Destroy chart instance. Safe to call more than once. */
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.playback.stop();
    this.teardown.run();
    this.rises.clear();
    this.ledger.clear();
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
    this.rises.settleParked(); // a rise turned off shows parked bubbles
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
