import type { Orb, OrbChartConfig } from "../types/types";
import { AccessibleLayer, type LayerConfig } from "./AccessibleLayer";
import { CanvasInput, type InputConfig } from "./CanvasInput";
import { CanvasRenderer } from "./CanvasRenderer";
import { FocusCue } from "./FocusCue";
import { TooltipView } from "./TooltipView";
import { Teardown } from "../core/Teardown";

/** The options the view reads. */
export type ViewConfig = OrbChartConfig & InputConfig & LayerConfig;

/** What the view asks of the chart that owns it. */
export interface ViewHost {
  /** Pointer press on the canvas, in canvas pixels. */
  onCanvasClick(x: number, y: number): void;
  /** An image finished loading. */
  onImageLoaded(): void;
  /** Milliseconds on the chart's clock, for the float offset. */
  elapsed(): number;
  /** Float wobble phase for an orb. */
  phaseOf(orb: Orb): number;
  /** Draws once if no loop is doing it. */
  redrawIfStopped(): void;
  /** The container changed size. */
  onResize(): void;
}

/**
 * Puts together everything the user sees and touches: the canvas, the tooltip,
 * the pointer input, the accessible list, the focus cue, and the resize
 * observer. If one part fails
 * to build, the parts before it are removed again.
 */
export class ChartView {
  private readonly renderer: CanvasRenderer;
  private readonly tooltip: TooltipView;
  private readonly input: CanvasInput;
  private readonly layer: AccessibleLayer;
  private readonly cue: FocusCue;
  private readonly teardown = new Teardown();

  constructor(
    container: HTMLElement,
    getConfig: () => ViewConfig,
    private readonly host: ViewHost,
  ) {
    try {
      this.renderer = new CanvasRenderer(
        container,
        getConfig(),
        host.onImageLoaded,
      );
      this.teardown.add(() => this.renderer.destroy());
      this.tooltip = new TooltipView(container, getConfig);
      this.input = new CanvasInput(
        this.renderer.element,
        this.tooltip,
        getConfig,
        host.onCanvasClick,
      );
      this.teardown.add(() => this.input.dispose());
      this.cue = new FocusCue({
        tooltip: this.tooltip,
        setRing: (id) => this.renderer.setFocus(id),
        centerOf: (orb) =>
          this.renderer.centerOf(orb, host.elapsed(), host.phaseOf(orb)),
        redraw: host.redrawIfStopped,
      });
      this.layer = new AccessibleLayer(container, getConfig, {
        onFocus: (orb) => this.cue.focus(orb),
        onEscape: () => this.cue.escape(),
      });
      this.teardown.add(() => this.layer.dispose());
      const observer = new ResizeObserver(() => host.onResize());
      this.teardown.add(() => observer.disconnect());
      observer.observe(container);
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  /** Draws one frame of `orbs`. */
  render(orbs: Orb[], elapsed: number) {
    this.renderer.render(orbs, elapsed, this.host.phaseOf);
  }

  /** Sets the canvas size in CSS pixels. */
  resize(width: number, height: number) {
    this.renderer.updateDimensions(width, height);
  }

  /** Starts loading the orbs' images. */
  preloadImages(orbs: Orb[]) {
    this.renderer.preloadImages(orbs);
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
    this.input.refresh();
    this.layer.update();
  }

  /** Still mode: no float wobble and no tooltip fade. */
  setStill(still: boolean) {
    this.renderer.setStill(still);
    this.tooltip.setFade(!still);
  }

  /** Removes everything the view added, newest first. */
  dispose() {
    this.teardown.run();
  }
}
