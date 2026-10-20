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
  minRadius?: number;
  maxRadius?: number;
  colorScheme?: string[];
  enableTooltip?: boolean;
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
