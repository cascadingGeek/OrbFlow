import type { Orb, OrbChartConfig } from "../types/types";
import { AccessibleLayer, type LayerConfig } from "./AccessibleLayer";
import { CanvasInput, type InputConfig } from "./CanvasInput";
import { BubblePainter } from "./BubblePainter";
import { BurstEffects, type PopSnapshot } from "./BurstEffects";
import { CanvasRenderer, type FrameTime } from "./CanvasRenderer";
import { EntranceGate } from "./EntranceGate";
import { FocusCue } from "./FocusCue";
import { ImageCache } from "./ImageCache";
import { LiveAnnouncer } from "./LiveAnnouncer";
import { TooltipView } from "./TooltipView";
import { Teardown } from "../core/Teardown";

/** The options the view reads. */
export type ViewConfig = OrbChartConfig & InputConfig & LayerConfig;

/** What the view asks of the chart that owns it. */
export interface ViewHost {
  /** A click or tap that missed every orb, in canvas pixels. */
  onCanvasMiss(x: number, y: number): void;
  /** A click, tap, Enter, or Space on an orb. */
  onActivate(orb: Orb, event: MouseEvent): void;
  /** An image finished loading. */
  onImageLoaded(): void;
  /** The loop clock, for bursts and ghosts. */
  now(): number;
  /** Milliseconds on the chart's clock, for the float offset. */
  elapsed(): number;
  /** Float wobble phase for an orb. */
  phaseOf(orb: Orb): number;
  /** How far below its place an orb is drawn at loop clock `now`, in pixels. */
  riseOf(orb: Orb, now: number): number;
  /** The chart scrolled into view for the first time. */
  onGateOpen(): void;
  /** Draws once if no loop is doing it. */
  redrawIfStopped(): void;
  /** The container changed size. */
  onResize(): void;
}

/**
 * Puts together everything the user sees and touches: the canvas with its
 * image cache and burst effects, the tooltip, the pointer input, the
 * accessible list, the live region, the focus cue, the entrance gate, and the
 * resize observer.
 * If one part fails to build, the parts before it are removed again.
 */
export class ChartView {
  private readonly images: ImageCache;
  private readonly effects: BurstEffects;
  private readonly announcer: LiveAnnouncer;
  private readonly renderer: CanvasRenderer;
  private readonly tooltip: TooltipView;
  private readonly input: CanvasInput;
  private readonly layer: AccessibleLayer;
  private readonly cue: FocusCue;
  private readonly gate: EntranceGate;
  private readonly teardown = new Teardown();

  constructor(
    container: HTMLElement,
    private readonly getConfig: () => ViewConfig,
    private readonly host: ViewHost,
  ) {
    try {
      this.images = new ImageCache(host.onImageLoaded);
      this.teardown.add(() => this.images.dispose());
      const painter = new BubblePainter();
      this.effects = new BurstEffects(painter);
      this.teardown.add(() => this.effects.clear());
      this.renderer = new CanvasRenderer(container, getConfig(), {
        images: this.images,
        painter,
        effects: this.effects,
        riseOf: host.riseOf,
      });
      this.teardown.add(() => this.renderer.destroy());
      this.tooltip = new TooltipView(container, getConfig);
      this.input = new CanvasInput(
        this.renderer.element,
        this.tooltip,
        getConfig,
        {
          onActivate: host.onActivate,
          onCanvasMiss: host.onCanvasMiss,
          centerOf: (orb) => this.centerOf(orb),
        },
      );
      this.teardown.add(() => this.input.dispose());
      this.cue = new FocusCue({
        tooltip: this.tooltip,
        setRing: (id) => this.renderer.setFocus(id),
        centerOf: (orb) => this.centerOf(orb),
        redraw: host.redrawIfStopped,
      });
      this.layer = new AccessibleLayer(container, getConfig, {
        onFocus: (orb) => this.cue.focus(orb),
        onEscape: () => this.cue.escape(),
        onActivate: host.onActivate,
      });
      this.teardown.add(() => this.layer.dispose());
      this.announcer = new LiveAnnouncer(container);
      this.teardown.add(() => this.announcer.dispose());
      this.gate = new EntranceGate(container, host.onGateOpen);
      this.teardown.add(() => this.gate.dispose());
      const observer = new ResizeObserver(() => host.onResize());
      this.teardown.add(() => observer.disconnect());
      observer.observe(container);
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  /** Draws one frame of `orbs`. */
  render(orbs: Orb[], time: FrameTime) {
    this.renderer.render(orbs, time, this.host.phaseOf);
  }

  /** The orb as drawn right now, or `null` when it has no size or place. */
  snapshotOf(orb: Orb, placed: boolean): PopSnapshot | null {
    if (orb.radius <= 0 || !placed) return null;
    const bubble = this.renderer.bubbleOf(
      orb,
      this.host.elapsed(),
      this.host.phaseOf,
      this.host.now(),
    );
    return { ...bubble, id: orb.id };
  }

  /** True once the chart has scrolled into view, or cannot be watched. */
  get gateOpen(): boolean {
    return this.gate.open;
  }

  /** Opens the gate for good without a callback (the chart paused or went still). */
  openGate() {
    this.gate.forceOpen();
  }

  /** Where `orb` is drawn now. Drawing, hit tests, and the cue all use it. */
  centerOf(orb: Orb) {
    const { host } = this;
    return this.renderer.centerOf(
      orb,
      host.elapsed(),
      host.phaseOf(orb),
      host.now(),
    );
  }

  /** Plays a burst (or, when idle, only leaves the ghost `popStyle` asks for). */
  burst(snapshot: PopSnapshot, now: number, idle: boolean) {
    const ghost = this.getConfig().popStyle === "ghost";
    this.effects.add(snapshot, now, ghost, idle);
  }

  /** Ends every burst and fades ghosts in fully. True if anything changed. */
  finishBursts(now: number): boolean {
    return this.effects.finishAll(now);
  }

  /** Removes the ghost of one bubble, because it came back. */
  removeGhost(id: string) {
    this.effects.removeGhost(id);
  }

  /** Removes every ghost. */
  clearGhosts() {
    this.effects.clearGhosts();
  }

  /** Tells screen reader users what happened. */
  announce(text: string) {
    this.announcer.announce(text);
  }

  /** Sets the canvas size in CSS pixels. */
  resize(width: number, height: number) {
    this.renderer.updateDimensions(width, height);
  }

  /** Starts loading the orbs' images. */
  preloadImages(orbs: Orb[]) {
    this.images.preload(orbs);
  }

  /** Tells the pointer input which orbs can be hit. */
  syncInput(live: Orb[]) {
    this.input.sync(live);
  }

  /** Makes the accessible list and the focus tooltip match the live orbs. */
  syncList(live: Orb[]) {
    this.layer.sync(live);
    this.cue.refresh();
  }

  /** Applies the new options to every part. */
  updateConfig(config: ViewConfig) {
    this.renderer.updateConfig(config);
    if (config.popStyle !== "ghost") this.effects.clearGhosts();
    this.input.refresh();
    this.layer.update();
  }

  /** Still mode: no float wobble, no tooltip fade, and no bursts. */
  setStill(still: boolean) {
    // A still chart shows only end states, so bursts in flight finish first.
    if (still) this.effects.finishAll(this.host.now());
    this.renderer.setStill(still);
    this.tooltip.setFade(!still);
  }

  /** Removes everything the view added, newest first. */
  dispose() {
    this.teardown.run();
  }
}
