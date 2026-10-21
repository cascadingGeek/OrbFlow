/**
 * Common types for OrbFlow
 */

export interface Orb {
  id: string;
  label: string;
  value: number;
  radius: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color?: string;
  imageUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface PhysicsConfig {
  damping?: number;
  minVelocity?: number;
  bounceCoefficient?: number;
  floatAmplitude?: number;
  floatSpeed?: number;
}

export interface OrbChartConfig extends PhysicsConfig {
  width?: number;
  height?: number;
  backgroundColor?: string;
  /**
   * The smallest radius in pixels a bubble is drawn with. Bubble area follows
   * the value (a value twice as big gets twice the area, up to `maxRadius` for
   * the largest value), and `minRadius` is a floor under that, so tiny values
   * stay visible. A negative or non finite value falls back to the default
   * with a console warning.
   * @default 8
   */
  minRadius?: number;
  /**
   * The radius in pixels of the bubble with the largest value.
   * @default 80
   */
  maxRadius?: number;
  colorScheme?: string[];
  enableTooltip?: boolean;
  /**
   * Called when a bubble is clicked, tapped, or activated with Enter or Space
   * from the keyboard. Runs before any pop (see `popOnClick`).
   * @default a no op
   */
  onOrbClick?: (orb: Orb, event: MouseEvent) => void;
  onOrbHover?: (orb: Orb | null) => void;
  /**
   * Length in milliseconds of enter, exit, resize, and retarget animations.
   * `0` makes them snap instantly. A negative or non finite value falls back
   * to the default with a console warning.
   * @default 400
   */
  transitionDuration?: number;
  /**
   * Called once per `setData` call that skipped any entry, after the update
   * was applied. Errors thrown by the handler are caught and logged.
   * @default a no op
   */
  onDataIssue?: (issues: OrbDataIssue[]) => void;
  /**
   * The accessible name of the chart, read by screen readers. An empty or
   * whitespace only string counts as unset.
   * @default "Bubble chart"
   */
  ariaLabel?: string;
  /**
   * A longer description for screen readers. Pass `""` to clear it:
   * `updateConfig` ignores `undefined`, and in React a removed prop keeps its
   * last value.
   * @default no description
   */
  ariaDescription?: string;
  /**
   * Whether orbs keep moving. The value is one of three strings:
   * `"auto"` follows the system "reduce motion" setting, `"always"` keeps the
   * orbs still, and `"never"` keeps them moving. A still chart settles its
   * orbs once and draws only when data, size, or options change. Any other
   * value logs a warning and falls back to `"auto"`.
   *
   * The accessible list holds one hidden button per orb. The buttons are not
   * positioned over the orbs, so tools that click by screen position will not
   * find them; the focus ring on the canvas shows where keyboard focus is.
   * @default "auto"
   */
  reducedMotion?: "auto" | "always" | "never";
  /**
   * Whether a click, tap, Enter, or Space on a bubble pops it, after
   * `onOrbClick` has run. `chart.pop(id)` works either way.
   * @default false
   */
  popOnClick?: boolean;
  /**
   * What a popped bubble leaves behind: `"remove"` leaves nothing, `"ghost"`
   * leaves a dashed outline with a faded label until the next `setData`. Any
   * other value logs a warning and falls back to `"remove"`.
   * @default "remove"
   */
  popStyle?: "remove" | "ghost";
  /**
   * Called once for every bubble that pops, with the orb as it was just
   * before it popped. Errors thrown by the handler are caught and logged.
   * @default a no op
   */
  onOrbPop?: (orb: Orb) => void;
  /**
   * How new bubbles enter. `"rise"` slides them up from below the chart, once
   * the chart has scrolled into view for the first time. `"grow"` grows them
   * from nothing where they are. A paused or still chart, and
   * `transitionDuration: 0`, skip both. Changing it affects only bubbles that
   * enter later. Any other value logs a warning and falls back to `"rise"`.
   * @default "rise"
   */
  enterStyle?: "rise" | "grow";
  /**
   * When `popOnClick` is on, whether clicking a bubble first brings back the
   * bubbles the user popped before. Bubbles popped with `chart.pop(id)` are
   * never brought back this way. A value that is not a boolean logs a warning
   * and falls back to `true`.
   * @default true
   */
  restoreOnNextPop?: boolean;
  /**
   * Called once for every bubble that comes back through `restore()` or
   * `restoreOnNextPop`, with the new live orb. Errors thrown by the handler
   * are caught and logged.
   * @default a no op
   */
  onOrbRestore?: (orb: Orb) => void;
  /**
   * Which bubble look to draw. `"auto"` picks `"light"` when
   * `backgroundColor` is a light color and `"dark"` otherwise (including
   * `"transparent"`, named colors, and `hsl()`, so set it yourself on a light
   * page behind a transparent chart). Any other value logs a warning and
   * falls back to `"auto"`.
   * @default "auto"
   */
  theme?: "auto" | "light" | "dark";
  /**
   * The font for bubble labels and values. The chart does not load fonts:
   * load the font on the page first. A value that is not a non empty string
   * logs a warning and falls back to the default.
   * @default "Inter, system-ui, sans-serif"
   */
  fontFamily?: string;
  /**
   * Turns a bubble's value into the text shown for it. The same text is drawn
   * on the canvas, shown in the tooltip's `Value:` line, and read by screen
   * readers, so the three always agree. `orb` is your own orb, the same one
   * `onOrbClick` gets.
   *
   * With no `formatValue` the text is `String(value)`, the plain number, with
   * no rounding: a float such as `0.1 + 0.2` shows in full, so format floats
   * yourself. `undefined` is ignored, so to go back to the plain number pass
   * `formatValue: String`. A result that is not a string is converted with
   * `String()`. An empty or whitespace only result hides the value
   * everywhere. A function that throws is logged once and the plain number is
   * used for that call. A value that is not a function logs a warning and
   * falls back to the plain number.
   *
   * It runs once per bubble per drawn frame, so keep it cheap. It must not
   * call `updateConfig` or `setData`, and must not change the orb.
   * @default (value) => String(value)
   */
  formatValue?: (value: number, orb: Orb) => string;
  /**
   * The smallest text size in pixels a label or value is drawn at. Text that
   * would need to be smaller is hidden instead. Lower it to show more text on
   * small bubbles, or raise it to hide small text; there is no upper limit,
   * and a large value simply hides text. Fractions are allowed. A value that
   * is not a finite number of at least 1 logs a warning and falls back to
   * the default.
   * @default 10
   */
  minTextSize?: number;
}

/**
 * Why one entry passed to `setData` was skipped. New reasons may be added in a
 * minor release, so handlers should keep a default branch.
 */
export interface OrbDataIssue {
  /** Position of the skipped entry in the array given to `setData`. */
  index: number;
  /** The entry's `id`, set only when the entry had a string `id`. */
  id?: string;
  /** What was wrong with the entry. */
  reason: "invalid-id" | "invalid-label" | "invalid-value" | "duplicate-id";
}

export interface OrbDataInput {
  id: string;
  label: string;
  value: number;
  color?: string;
  imageUrl?: string;
  metadata?: Record<string, unknown>;
}
