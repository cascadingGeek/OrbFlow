import type { Orb, OrbChartConfig } from "../types/types";

/**
 * The one place a bubble's value turns into text. A faulty `formatValue`
 * never reaches a frame: a throw is logged once per chart and the plain number
 * is used. It also remembers the text of the last frame, so the tooltip and
 * the hidden list show what the canvas drew without calling the formatter
 * again. It holds no timers and no listeners.
 */
export class ValueFormatter {
  private drawn = new Map<
    string,
    { value: number; label: string; text: string }
  >();
  private logged = false;

  constructor(
    private readonly getConfig: () => Pick<OrbChartConfig, "formatValue">,
  ) {}

  /** The text for `orb`, or `""` when it is empty or only whitespace. */
  text(orb: Orb): string {
    return this.remember(orb, this.format(orb));
  }

  /**
   * The text drawn last for `orb`. If it was never drawn, or its value or
   * label has changed since, one fresh text is made and kept until the next
   * frame draws it, so readers between frames never call the formatter twice.
   * A formatter that reads other fields shows them from the next draw.
   */
  drawnText(orb: Orb): string {
    const drawn = this.drawn.get(orb.id);
    if (drawn?.value === orb.value && drawn.label === orb.label) {
      return drawn.text;
    }
    return this.remember(orb, this.format(orb));
  }

  /** Forgets last frame's texts. Call before each frame is drawn. */
  beginFrame() {
    this.drawn.clear();
  }

  private remember(orb: Orb, text: string): string {
    this.drawn.set(orb.id, { value: orb.value, label: orb.label, text });
    return text;
  }

  private format(orb: Orb): string {
    const { formatValue } = this.getConfig();
    let text: string;
    try {
      text = String(
        typeof formatValue === "function"
          ? formatValue(orb.value, orb)
          : orb.value,
      );
    } catch (error) {
      if (!this.logged) {
        this.logged = true;
        console.error("OrbFlow: formatValue handler threw.", error);
      }
      text = String(orb.value);
    }
    return text.trim() === "" ? "" : text;
  }
}
