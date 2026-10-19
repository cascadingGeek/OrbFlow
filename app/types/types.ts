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
