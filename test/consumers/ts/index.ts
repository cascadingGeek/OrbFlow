// Type checks both entries from a CommonJS file (node10, nodenext) and an
// ESM file under bundler resolution (AC-2, AC-3).
import { OrbChart } from "orbflow";
import type { OrbChartConfig, OrbDataInput } from "orbflow";
import { OrbChart as ReactOrbChart } from "orbflow/react";
import type { OrbChartProps } from "orbflow/react";
// @ts-expect-error: internals are not part of the public surface
import { PhysicsEngine } from "orbflow";

const config: OrbChartConfig = { width: 400, height: 300 };
const data: OrbDataInput[] = [{ id: "a", label: "A", value: 1 }];
const props: OrbChartProps = { ...config, data };

export const used = [OrbChart, ReactOrbChart, props, PhysicsEngine];
