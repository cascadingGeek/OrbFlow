import type { Orb } from "../types/types";

/** The standard clip pattern: invisible, but still in the accessibility tree. */
export const HIDDEN_STYLE =
  "position:absolute;top:0;left:0;width:1px;height:1px;margin:-1px;padding:0;" +
  "border:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);" +
  "white-space:nowrap;";

/** One button in the list, with the orb it stands for. */
export interface Entry {
  li: HTMLLIElement;
  button: HTMLButtonElement;
  orb: Orb;
}

export const randomId = () =>
  `orbflow-desc-${Math.random().toString(36).slice(2, 10)}`;

/** A list item holding one empty button, out of the tab order. */
export function newItem() {
  const button = document.createElement("button");
  button.type = "button";
  button.tabIndex = -1;
  const li = document.createElement("li");
  li.appendChild(button);
  return { li, button };
}

/**
 * What a screen reader hears for an orb: label, value text, and any category.
 * `valueText` is what the canvas shows; `""` leaves the value out.
 */
export function buttonText(
  orb: Orb,
  valueText: string = String(orb.value),
): string {
  const category = orb.metadata?.category;
  return (
    (orb.label || orb.id) +
    (valueText ? `, value ${valueText}` : "") +
    (category ? `, category ${String(category)}` : "")
  );
}

/**
 * Puts `items` into `parent` in the given order. It walks from the end and
 * never moves `keep`, so a focused item keeps its focus.
 */
export function reorderChildren(
  parent: Node,
  items: Node[],
  keep: Node | undefined,
) {
  let after: Node | null = null;
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    const placed = item.parentNode === parent && item.nextSibling === after;
    if (item !== keep && !placed) parent.insertBefore(item, after);
    after = item;
  }
}

/**
 * Where focus goes when the focused item is removed: the next one that
 * survives, else the previous one that survives, else `undefined`.
 */
export function survivorAfter(
  previous: string[],
  lostId: string,
  live: Set<string>,
): string | undefined {
  const at = previous.indexOf(lostId);
  const after = previous.slice(at + 1).find((id) => live.has(id));
  return (
    after ??
    previous
      .slice(0, at)
      .reverse()
      .find((id) => live.has(id))
  );
}

/**
 * The index an arrow, Home, or End key moves to from `at`, or `undefined` for
 * any other key. The result may lie outside `0..last`: there is no wrap.
 */
export function keyTarget(
  key: string,
  at: number,
  last: number,
): number | undefined {
  const moves: Record<string, number> = {
    ArrowRight: at + 1,
    ArrowDown: at + 1,
    ArrowLeft: at - 1,
    ArrowUp: at - 1,
    Home: 0,
    End: last,
  };
  return moves[key];
}

/**
 * Makes `container` a positioning context for the hidden list, but only when
 * it is not positioned already. Returns a function that puts the old inline
 * value back.
 */
export function ensurePositioned(container: HTMLElement): () => void {
  // A detached element reports an empty position, which is not positioned.
  const position = getComputedStyle(container).position;
  if (position !== "static" && position !== "") return () => {};
  const previous = container.style.position;
  container.style.position = "relative";
  return () => {
    container.style.position = previous;
  };
}

/** A hidden text element that exists only while it has text to show. */
export class HiddenText {
  private el: HTMLSpanElement | null = null;

  constructor(
    private readonly container: HTMLElement,
    private readonly makeId: () => string,
  ) {}

  /** Shows `text` and returns the element id, or removes it for `""`. */
  set(text: string): string | null {
    if (!text) {
      this.remove();
      return null;
    }
    if (!this.el) {
      this.el = document.createElement("span");
      this.el.id = this.makeId();
      this.el.style.cssText = HIDDEN_STYLE;
      this.container.appendChild(this.el);
    }
    this.el.textContent = text;
    return this.el.id;
  }

  /** Removes the element. */
  remove() {
    this.el?.remove();
    this.el = null;
  }
}
