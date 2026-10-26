/** A bubble as the chart holds it: your data plus its size, place, and speed. */
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

/** Physics options. Unset values use the engine's defaults. */
export interface PhysicsConfig {
  damping?: number;
  minVelocity?: number;
  bounceCoefficient?: number;
  floatAmplitude?: number;
  floatSpeed?: number;
}

/** Options for `OrbChart`. See the README for every option in full. */
export interface OrbChartConfig extends PhysicsConfig {
  width?: number;
  height?: number;
  backgroundColor?: string;
  /**
   * Smallest bubble radius in pixels; area follows value above this floor.
   * @default 8
   */
  minRadius?: number;
  /** Radius in pixels of the bubble with the largest value. @default 80 */
  maxRadius?: number;
  colorScheme?: string[];
  enableTooltip?: boolean;
  /**
   * Called on a click, tap, Enter, or Space on a bubble, before any pop.
   * @default a no op
   */
  onOrbClick?: (orb: Orb, event: MouseEvent) => void;
  onOrbHover?: (orb: Orb | null) => void;
  /** Length in ms of enter, exit, resize, and retarget animations. @default 400 */
  transitionDuration?: number;
  /** Called once per `setData` that skipped entries. @default a no op */
  onDataIssue?: (issues: OrbDataIssue[]) => void;
  /** Accessible name of the chart. @default "Bubble chart" */
  ariaLabel?: string;
  /** Longer screen reader description; pass `""` to clear it. @default none */
  ariaDescription?: string;
  /**
   * `"auto"` follows the system setting, `"always"` keeps orbs still, `"never"`
   * keeps them moving. @default "auto"
   */
  reducedMotion?: "auto" | "always" | "never";
  /** Whether activating a bubble pops it, after `onOrbClick`. @default false */
  popOnClick?: boolean;
  /** What a popped bubble leaves: nothing, or a dashed ghost. @default "remove" */
  popStyle?: "remove" | "ghost";
  /** Called once per popped bubble, with the orb as it was. @default a no op */
  onOrbPop?: (orb: Orb) => void;
  /**
   * `"rise"` slides new bubbles up once the chart is in view, `"grow"` grows
   * them in place. @default "rise"
   */
  enterStyle?: "rise" | "grow";
  /**
   * With `popOnClick`, a click first brings back bubbles the user popped.
   * @default true
   */
  restoreOnNextPop?: boolean;
  /** Called once per bubble brought back, with the new orb. @default a no op */
  onOrbRestore?: (orb: Orb) => void;
  /**
   * Bubble look. `"auto"` picks light for a light `backgroundColor`.
   * @default "auto"
   */
  theme?: "auto" | "light" | "dark";
  /**
   * Font for labels and values; load it on the page first.
   * @default "Inter, system-ui, sans-serif"
   */
  fontFamily?: string;
  /**
   * Text for a bubble's value on the canvas, tooltip, and screen readers.
   * Keep it cheap and side effect free. @default String
   */
  formatValue?: (value: number, orb: Orb) => string;
  /** Smallest text size in pixels; smaller text is hidden. @default 10 */
  minTextSize?: number;
}

/** Why one `setData` entry was skipped. New reasons may come in minor releases. */
export interface OrbDataIssue {
  /** Position of the skipped entry in the array given to `setData`. */
  index: number;
  /** The entry's `id`, set only when the entry had a string `id`. */
  id?: string;
  /** What was wrong with the entry. */
  reason: "invalid-id" | "invalid-label" | "invalid-value" | "duplicate-id";
}

/** One entry passed to `setData`. */
export interface OrbDataInput {
  id: string;
  label: string;
  value: number;
  color?: string;
  imageUrl?: string;
  metadata?: Record<string, unknown>;
}
