import type { Orb } from "../../types/types";

/** Which way an orb's radius is moving. */
type TransitionPhase = "enter" | "update" | "exit";

/** One running radius animation. Internal, one per orb by `id`. */
interface OrbTransition {
  fromRadius: number;
  toRadius: number;
  startedAt: number;
  duration: number;
  phase: TransitionPhase;
}

/**
 * Advances each orb's `radius` over time with an ease out cubic curve. It takes
 * the time as an argument, so tests drive it with a fake clock.
 */
export class RadiusTweener {
  private transitions = new Map<string, OrbTransition>();

  constructor(private readonly onExited: (orb: Orb) => void = () => {}) {}

  /** Starts (or restarts) a tween from the orb's current radius. */
  start(
    orb: Orb,
    toRadius: number,
    now: number,
    duration: number,
    phase: TransitionPhase,
  ) {
    this.transitions.set(orb.id, {
      fromRadius: orb.radius,
      toRadius,
      startedAt: now,
      duration,
      phase,
    });
  }

  /**
   * Points an existing orb at a new target. A running tween that already aims
   * at the same target is left alone, and so is a settled orb already there.
   * An exiting orb is revived.
   */
  retarget(orb: Orb, toRadius: number, now: number, duration: number) {
    const running = this.transitions.get(orb.id);
    if (running && running.phase !== "exit" && running.toRadius === toRadius) {
      return;
    }
    if (!running && orb.radius === toRadius) return;
    this.start(orb, toRadius, now, duration, "update");
  }

  /** Stops the orb's tween where it is, without calling `onExited`. */
  cancel(id: string) {
    this.transitions.delete(id);
  }

  /** True while the orb is shrinking out. */
  isExiting(orb: Orb): boolean {
    return this.transitions.get(orb.id)?.phase === "exit";
  }

  /** Sets every orb's radius for `now` and returns the orbs that remain. */
  step(orbs: Orb[], now: number): Orb[] {
    const survivors: Orb[] = [];
    for (const orb of orbs) {
      const tween = this.transitions.get(orb.id);
      if (!tween) {
        survivors.push(orb);
        continue;
      }
      const t =
        tween.duration <= 0
          ? 1
          : Math.min(1, Math.max(0, (now - tween.startedAt) / tween.duration));
      const eased = 1 - (1 - t) ** 3;
      orb.radius =
        t >= 1
          ? tween.toRadius
          : tween.fromRadius + (tween.toRadius - tween.fromRadius) * eased;

      if (t < 1) {
        survivors.push(orb);
        continue;
      }
      this.transitions.delete(orb.id);
      if (tween.phase === "exit") this.onExited(orb);
      else survivors.push(orb);
    }
    return survivors;
  }
}
