import type { OrbChartConfig, PhysicsConfig } from "../../types/types";
import { TextOptions } from "./TextOptions";

/** An `OrbChartConfig` with every option except the physics ones filled in. */
export type ResolvedConfig = Required<
  Omit<OrbChartConfig, keyof PhysicsConfig>
> &
  PhysicsConfig;

const DEFAULT_TRANSITION_MS = 400;
const DEFAULT_ARIA_LABEL = "Bubble chart";
const MOTION_VALUES = ["auto", "always", "never"];
const DEFAULT_MIN_RADIUS = 8;

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
 * option checks, which warn once per bad value.
 */
export class ConfigResolver {
  private readonly warned = new Set<string>();
  private readonly text = new TextOptions((name, value, message) =>
    this.warnOnce(name, value, message),
  );

  /** Fills every default. `size` is the fallback width and height. */
  resolve(
    config: OrbChartConfig,
    size: { width: number; height: number },
  ): ResolvedConfig {
    return {
      width: config.width ?? size.width,
      height: config.height ?? size.height,
      backgroundColor: config.backgroundColor ?? "#0a0e1a",
      minRadius: this.validMinRadius(config.minRadius),
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
      popOnClick: config.popOnClick ?? false,
      popStyle: this.oneOf("popStyle", config.popStyle, ["remove", "ghost"]),
      onOrbPop: config.onOrbPop ?? (() => {}),
      enterStyle: this.oneOf("enterStyle", config.enterStyle, ["rise", "grow"]),
      restoreOnNextPop: this.validRestore(config.restoreOnNextPop),
      onOrbRestore: config.onOrbRestore ?? (() => {}),
      theme: this.oneOf("theme", config.theme, ["auto", "light", "dark"]),
      fontFamily: this.text.font(config.fontFamily),
      formatValue: this.text.format(config.formatValue),
      minTextSize: this.text.size(config.minTextSize),
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
    merged.minRadius = this.validMinRadius(merged.minRadius);
    merged.fontFamily = this.text.font(merged.fontFamily);
    merged.formatValue = this.text.format(merged.formatValue);
    merged.minTextSize = this.text.size(merged.minTextSize);
    merged.theme = this.oneOf("theme", merged.theme, ["auto", "light", "dark"]);
    merged.popStyle = this.oneOf("popStyle", merged.popStyle, [
      "remove",
      "ghost",
    ]);
    merged.enterStyle = this.oneOf("enterStyle", merged.enterStyle, [
      "rise",
      "grow",
    ]);
    merged.restoreOnNextPop = this.validRestore(merged.restoreOnNextPop);
    return merged;
  }

  private validRestore(value: unknown): boolean {
    if (value === undefined) return true;
    if (typeof value === "boolean") return value;
    this.warnOnce(
      "restoreOnNextPop",
      value,
      "restoreOnNextPop must be true or false, using true.",
    );
    return true;
  }

  private validMinRadius(value: unknown): number {
    if (value === undefined) return DEFAULT_MIN_RADIUS;
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      return value;
    }
    this.warnOnce(
      "minRadius",
      value,
      `minRadius must be a number of 0 or more, using ${DEFAULT_MIN_RADIUS}.`,
    );
    return DEFAULT_MIN_RADIUS;
  }

  // The first allowed value is the default.
  private oneOf<T extends string>(
    name: string,
    value: unknown,
    allowed: T[],
  ): T {
    if (value === undefined) return allowed[0];
    if (allowed.includes(value as T)) return value as T;
    const list = allowed.map((v) => `"${v}"`).join(" or ");
    this.warnOnce(
      name,
      value,
      `${name} must be ${list}, using "${allowed[0]}".`,
    );
    return allowed[0];
  }

  private warnOnce(name: string, value: unknown, message: string) {
    const key = `${name}:${typeof value}:${String(value)}`;
    if (this.warned.has(key)) return;
    this.warned.add(key);
    console.warn(`OrbFlow: ${message}`);
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
