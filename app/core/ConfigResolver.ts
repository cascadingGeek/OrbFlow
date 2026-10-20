import type { OrbChartConfig, PhysicsConfig } from "../types/types";

/** An `OrbChartConfig` with every option except the physics ones filled in. */
export type ResolvedConfig = Required<
  Omit<OrbChartConfig, keyof PhysicsConfig>
> &
  PhysicsConfig;

const DEFAULT_TRANSITION_MS = 400;
const DEFAULT_ARIA_LABEL = "Bubble chart";
const MOTION_VALUES = ["auto", "always", "never"];

// Cool color palette (Blues, Cyans, Purples)
const DEFAULT_COLORS = [
  "#3b82f6", // blue-500
  "#06b6d4", // cyan-500
  "#8b5cf6", // violet-500
  "#6366f1", // indigo-500
  "#0ea5e9", // sky-500
  "#a855f7", // purple-500
  "#22d3ee", // cyan-400
  "#818cf8", // indigo-400
];

/**
 * Owns the option defaults, the merge that ignores `undefined`, and the
 * checks for `transitionDuration`, `ariaLabel`, and `reducedMotion`.
 */
export class ConfigResolver {
  /** Fills every default. `size` is the fallback width and height. */
  resolve(
    config: OrbChartConfig,
    size: { width: number; height: number },
  ): ResolvedConfig {
    return {
      width: config.width ?? size.width,
      height: config.height ?? size.height,
      backgroundColor: config.backgroundColor ?? "#0a0e1a",
      minRadius: config.minRadius ?? 25,
      maxRadius: config.maxRadius ?? 80,
      colorScheme: config.colorScheme ?? DEFAULT_COLORS,
      enableTooltip: config.enableTooltip ?? true,
      onOrbClick: config.onOrbClick ?? (() => {}),
      onOrbHover: config.onOrbHover ?? (() => {}),
      onDataIssue: config.onDataIssue ?? (() => {}),
      transitionDuration: this.validDuration(config.transitionDuration),
      ariaLabel: this.validLabel(config.ariaLabel),
      ariaDescription: config.ariaDescription ?? "",
      reducedMotion: this.validMotion(config.reducedMotion),
      damping: config.damping,
      minVelocity: config.minVelocity,
      bounceCoefficient: config.bounceCoefficient,
      floatAmplitude: config.floatAmplitude ?? 2.0,
      floatSpeed: config.floatSpeed ?? 0.002,
    };
  }

  /** Merges only the defined keys, so a default is never overwritten. */
  merge(
    current: ResolvedConfig,
    partial: Partial<OrbChartConfig>,
  ): ResolvedConfig {
    const defined: Record<string, unknown> = {};
    for (const key of Object.keys(partial) as (keyof OrbChartConfig)[]) {
      if (partial[key] !== undefined) defined[key] = partial[key];
    }
    const merged: ResolvedConfig = Object.assign({}, current, defined);
    merged.transitionDuration = this.validDuration(merged.transitionDuration);
    merged.ariaLabel = this.validLabel(merged.ariaLabel);
    merged.reducedMotion = this.validMotion(merged.reducedMotion);
    return merged;
  }

  private validLabel(value: string | undefined): string {
    return typeof value === "string" && value.trim() !== ""
      ? value
      : DEFAULT_ARIA_LABEL;
  }

  private validMotion(value: unknown): "auto" | "always" | "never" {
    if (value === undefined) return "auto";
    if (typeof value === "string" && MOTION_VALUES.includes(value)) {
      return value as "auto" | "always" | "never";
    }
    console.warn(
      'OrbFlow: reducedMotion must be "auto", "always", or "never", using "auto".',
    );
    return "auto";
  }

  private validDuration(value: number | undefined): number {
    if (value === undefined) return DEFAULT_TRANSITION_MS;
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      return value;
    }
    console.warn(
      `OrbFlow: transitionDuration must be a number of 0 or more, using ${DEFAULT_TRANSITION_MS}.`,
    );
    return DEFAULT_TRANSITION_MS;
  }
}
