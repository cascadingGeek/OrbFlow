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
};
const data: OrbDataInput[] = [{ id: "a", label: "A", value: 1 }];
const props: OrbChartProps = { ...config, data };

// The ref handle has exactly start, pause, and getData (spec 0003 AC-11).
const handle: { current: OrbChartHandle | null } = { current: null };
handle.current?.start();
handle.current?.pause();
const orbCount: number = handle.current?.getData().length ?? 0;
// @ts-expect-error: the handle has no destroy, React owns the lifecycle
handle.current?.destroy();

export const used = [
  handle,
  orbCount,
  OrbChart,
  ReactOrbChart,
  props,
  PhysicsEngine,
  reactIssues,
];
