import type { Orb, OrbChartConfig } from "@/types/types";

/**
 * The one place a value turns into text. A throwing `formatValue` is logged
 * once and the plain number is used; last frame's text is kept for readers.
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
   * The text drawn last for `orb`, or a fresh one kept until the next frame
   * when it was never drawn or its value or label changed.
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
