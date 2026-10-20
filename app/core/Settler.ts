import type { Orb } from "../types/types";

/** The physics step the settler needs. */
export interface Steppable {
  update(orbs: Orb[], drift?: boolean): Orb[];
}

/** How many physics steps a settle runs. */
const SETTLE_TICKS = 120;

/**
 * Lets orbs find their resting places in one go, for a chart that holds still.
 * Velocities are zeroed before and after, so nothing keeps drifting.
 */
export class Settler {
  constructor(
    private readonly physics: Steppable,
    private readonly ticks = SETTLE_TICKS,
  ) {}

  /** Runs the settle on `orbs` in place. */
  settle(orbs: Orb[]) {
    this.stop(orbs);
    for (let i = 0; i < this.ticks; i++) this.physics.update(orbs, false);
    this.stop(orbs);
  }

  private stop(orbs: Orb[]) {
    for (const orb of orbs) {
      orb.vx = 0;
      orb.vy = 0;
    }
  }
}
