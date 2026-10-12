// ESM file: both entries resolve, and neither has a default export (AC-2, AC-3).
// @ts-expect-error: orbflow has named exports only
import OrbFlowDefault from "orbflow";
// @ts-expect-error: orbflow/react has named exports only
import ReactDefault from "orbflow/react";
import { OrbChart } from "orbflow";
import { OrbChart as ReactOrbChart } from "orbflow/react";

export const used = [OrbFlowDefault, ReactDefault, OrbChart, ReactOrbChart];
