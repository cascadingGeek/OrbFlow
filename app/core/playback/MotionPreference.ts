import type { OrbChartConfig } from "../../types/types";

type Setting = NonNullable<OrbChartConfig["reducedMotion"]>;
type MatchMedia = (query: string) => MediaQueryList;

const QUERY = "(prefers-reduced-motion: reduce)";

const systemMatchMedia = (): MatchMedia | undefined =>
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia.bind(window)
    : undefined;

/**
 * Works out whether the chart should hold still, from the `reducedMotion`
 * option and the system "reduce motion" setting. It tells its owner when the
 * answer flips. `matchMedia` is an argument, so tests can fake it.
 */
export class MotionPreference {
  private system = false;
  private current: boolean;
  private readonly query: MediaQueryList | null;
  private readonly onSystemChange = (event: { matches: boolean }) => {
    this.system = event.matches;
    this.refresh();
  };

  constructor(
    private setting: Setting,
    private readonly onChange: (reduced: boolean) => void,
    matchMedia: MatchMedia | undefined = systemMatchMedia(),
  ) {
    this.query = matchMedia ? matchMedia(QUERY) : null;
    this.system = this.query?.matches ?? false;
    this.current = this.resolve();
    // Always listen, so a later switch to "auto" already knows the system.
    if (this.query?.addEventListener) {
      this.query.addEventListener("change", this.onSystemChange);
    } else {
      this.query?.addListener(this.onSystemChange);
    }
  }

  /** True when the chart should hold still. */
  get reduced(): boolean {
    return this.current;
  }

  /** Applies a new `reducedMotion` value, and reports a flip. */
  setSetting(setting: Setting) {
    this.setting = setting;
    this.refresh();
  }

  /** Stops listening to the system setting. */
  dispose() {
    if (this.query?.removeEventListener) {
      this.query.removeEventListener("change", this.onSystemChange);
    } else {
      this.query?.removeListener(this.onSystemChange);
    }
  }

  private resolve(): boolean {
    if (this.setting === "always") return true;
    if (this.setting === "never") return false;
    return this.system;
  }

  private refresh() {
    const next = this.resolve();
    if (next === this.current) return;
    this.current = next;
    this.onChange(next);
  }
}
