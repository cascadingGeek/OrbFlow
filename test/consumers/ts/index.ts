// Type checks both entries from a CommonJS file (node10, nodenext) and an
// ESM file under bundler resolution (AC-2, AC-3).
import { OrbChart } from "orbflow";
import type { OrbChartConfig, OrbDataInput, OrbDataIssue } from "orbflow";
import { OrbChart as ReactOrbChart } from "orbflow/react";
import type {
  OrbChartHandle,
  OrbChartProps,
  OrbDataIssue as ReactOrbDataIssue,
} from "orbflow/react";
// @ts-expect-error: internals are not part of the public surface
import { PhysicsEngine } from "orbflow";

const issues: OrbDataIssue[] = [{ index: 0, reason: "invalid-id" }];
const reactIssues: ReactOrbDataIssue[] = issues;
const config: OrbChartConfig = {
  width: 400,
  height: 300,
  transitionDuration: 200,
  onDataIssue: (found) => found.length,
  ariaLabel: "Sales by region",
  ariaDescription: "Bigger orbs mean more sales.",
  reducedMotion: "auto",
  // Spec 0005: popping and the bubble look (AC-15).
  popOnClick: true,
  popStyle: "ghost",
  onOrbPop: (orb) => orb.id,
  theme: "light",
  fontFamily: "Nunito, sans-serif",
  minRadius: 8,
};
const data: OrbDataInput[] = [{ id: "a", label: "A", value: 1 }];
const props: OrbChartProps = { ...config, data };

// reducedMotion is a union of three strings (spec 0004 AC-13).
const motion: NonNullable<OrbChartConfig["reducedMotion"]>[] = [
  "auto",
  "always",
  "never",
];
// @ts-expect-error: only auto, always, and never are accepted
const badMotion: OrbChartConfig = { reducedMotion: "sometimes" };

// @ts-expect-error: popStyle is "remove" or "ghost"
const badPop: OrbChartConfig = { popStyle: "explode" };
// @ts-expect-error: theme is "auto", "light", or "dark"
const badTheme: OrbChartConfig = { theme: "sepia" };
const popped: boolean = new OrbChart("#chart", config).pop("a");

// The ref handle has start, pause, getData (spec 0003 AC-11), and pop
// (spec 0005 AC-14).
const handle: { current: OrbChartHandle | null } = { current: null };
handle.current?.start();
handle.current?.pause();
const orbCount: number = handle.current?.getData().length ?? 0;
const handlePopped: boolean = handle.current?.pop("a") ?? false;
// @ts-expect-error: the handle has no destroy, React owns the lifecycle
handle.current?.destroy();

export const used = [
  handle,
  orbCount,
  OrbChart,
  ReactOrbChart,
  props,
  motion,
  badMotion,
  PhysicsEngine,
  reactIssues,
  badPop,
  badTheme,
  popped,
  handlePopped,
];
