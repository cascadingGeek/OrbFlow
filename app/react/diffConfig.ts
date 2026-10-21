import type { OrbChartConfig } from "../types/types";

/** Props that carry functions. They never reach `updateConfig`. */
export const CALLBACK_KEYS = [
  "onOrbClick",
  "onOrbHover",
  "onDataIssue",
  "onOrbPop",
  "onOrbRestore",
] as const;

/** Config values the chart can be updated with, without the callbacks. */
export type ConfigValues = Omit<OrbChartConfig, (typeof CALLBACK_KEYS)[number]>;

function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => Object.is(item, b[i]));
  }
  return Object.is(a, b);
}

/**
 * Compares the config props of this render with the ones last applied.
 * Values are compared with `Object.is`, and arrays item by item. A key that
 * became `undefined` is skipped and keeps its old value, because the chart
 * ignores `undefined` too.
 *
 * @returns `changes` for `updateConfig`, and `applied` to remember next time.
 */
export function diffConfig(
  applied: ConfigValues,
  next: ConfigValues,
): { changes: ConfigValues; applied: ConfigValues } {
  const changes: Record<string, unknown> = {};
  const merged: Record<string, unknown> = { ...applied };
  const keys = new Set([...Object.keys(applied), ...Object.keys(next)]);
  for (const key of keys) {
    const value = (next as Record<string, unknown>)[key];
    if (value === undefined) continue;
    if (sameValue((applied as Record<string, unknown>)[key], value)) continue;
    changes[key] = value;
    merged[key] = value;
  }
  return { changes: changes as ConfigValues, applied: merged as ConfigValues };
}
