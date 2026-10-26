import type { Orb, OrbChartConfig } from "../../types/types";
import {
  HIDDEN_STYLE,
  type Entry,
  HiddenText,
  buttonText,
  ensurePositioned,
  keyTarget,
  newItem,
  randomId,
  reorderChildren,
  survivorAfter,
} from "./listDom";

/** The pieces of config the layer reads, looked up on every event. */
export type LayerConfig = Required<
  Pick<OrbChartConfig, "ariaLabel" | "ariaDescription">
>;

/** What the layer tells its owner. */
interface LayerHooks {
  /** The focused orb changed. `null` means focus left the list. */
  onFocus(orb: Orb | null): void;
  /** Escape was pressed. Return true if it hid something. */
  onEscape(): boolean;
  /** An orb's button was clicked, or pressed with Enter or Space. */
  onActivate(orb: Orb, event: MouseEvent): void;
  /** The value text the canvas draws for an orb. Defaults to the number. */
  valueTextOf?(orb: Orb): string;
}

/**
 * A visually hidden list with one real button per orb. Screen readers and the
 * keyboard use it, while the canvas stays the picture. It owns the delegated
 * listeners, the roving tab stop, and the rule for lost focus.
 */
export class AccessibleLayer {
  private readonly list = document.createElement("ul");
  private readonly description: HiddenText;
  private readonly entries = new Map<string, Entry>();
  private readonly idOf = new WeakMap<Element, string>();
  private order: string[] = [];
  private lastFocusedId: string | null = null;
  private readonly restorePosition: () => void;
  private disposed = false;

  private readonly listeners: [string, EventListener][] = [
    ["keydown", (e) => this.onKeyDown(e as KeyboardEvent)],
    ["focusin", (e) => this.onFocusIn(e as FocusEvent)],
    ["focusout", (e) => this.onFocusOut(e as FocusEvent)],
    ["click", (e) => this.onClick(e as MouseEvent)],
  ];

  constructor(
    container: HTMLElement,
    private readonly getConfig: () => LayerConfig,
    private readonly hooks: LayerHooks,
    makeId: () => string = randomId,
  ) {
    // The list is placed against the container, which must be positioned.
    this.restorePosition = ensurePositioned(container);
    this.description = new HiddenText(container, makeId);
    this.list.setAttribute("role", "list");
    this.list.tabIndex = -1;
    this.list.style.cssText = HIDDEN_STYLE + "list-style:none;";
    container.appendChild(this.list);
    for (const [type, listener] of this.listeners) {
      this.list.addEventListener(type, listener);
    }
    this.update();
  }

  /** Applies `ariaLabel` and `ariaDescription` in place. */
  update() {
    const { ariaLabel, ariaDescription } = this.getConfig();
    this.list.setAttribute("aria-label", ariaLabel);
    const id = this.description.set(ariaDescription);
    if (id) this.list.setAttribute("aria-describedby", id);
    else this.list.removeAttribute("aria-describedby");
  }

  /** Makes the buttons match the live orbs, in order, keeping focus. */
  sync(live: Orb[]) {
    if (this.disposed) return;
    const active = document.activeElement;
    const hadFocus = active !== null && this.list.contains(active);
    const focusedId = active ? this.idOf.get(active) : undefined;
    const previous = this.order;
    const next = new Set(live.map((orb) => orb.id));

    for (const [id, entry] of this.entries) {
      if (next.has(id)) continue;
      entry.li.remove();
      this.entries.delete(id);
    }
    for (const orb of live) this.upsert(orb);
    this.refreshText();
    this.order = live.map((orb) => orb.id);
    reorderChildren(
      this.list,
      this.order.map((id) => this.entryOf(id).li),
      focusedId ? this.entries.get(focusedId)?.li : undefined,
    );

    if (hadFocus && focusedId && !next.has(focusedId)) {
      this.moveFocusFrom(focusedId, previous, next);
    }
    this.applyTabStops();
  }

  /** Removes the list, the description, and every listener. */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const [type, listener] of this.listeners) {
      this.list.removeEventListener(type, listener);
    }
    this.list.remove();
    this.description.remove();
    this.entries.clear();
    this.restorePosition();
  }

  private upsert(orb: Orb) {
    let entry = this.entries.get(orb.id);
    if (!entry) {
      const { li, button } = newItem();
      this.idOf.set(button, orb.id);
      entry = { li, button, orb };
      this.entries.set(orb.id, entry);
    }
    entry.orb = orb;
  }

  /** Rewrites changed button text in place, so focus stays. */
  refreshText() {
    for (const { button, orb } of this.entries.values()) {
      // Orb data is user supplied: set it as text, never as HTML.
      const text = buttonText(orb, this.hooks.valueTextOf?.(orb));
      if (button.textContent !== text) button.textContent = text;
    }
  }

  private moveFocusFrom(lostId: string, previous: string[], live: Set<string>) {
    const target = survivorAfter(previous, lostId, live);
    this.lastFocusedId = target ?? null;
    if (target) {
      this.entryOf(target).button.focus();
    } else {
      this.list.focus();
      this.hooks.onFocus(null);
    }
  }

  private applyTabStops() {
    const stop =
      this.lastFocusedId && this.entries.has(this.lastFocusedId)
        ? this.lastFocusedId
        : this.order[0];
    for (const [id, entry] of this.entries) {
      entry.button.tabIndex = id === stop ? 0 : -1;
    }
  }

  private entryOf(id: string): Entry {
    const entry = this.entries.get(id);
    if (!entry) throw new Error(`OrbFlow: no list item for "${id}".`);
    return entry;
  }

  private buttonId(target: EventTarget | null): string | undefined {
    const button = (target as Element | null)?.closest?.("button");
    return button ? this.idOf.get(button) : undefined;
  }

  private onKeyDown(event: KeyboardEvent) {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    if (event.key === "Escape") {
      if (this.hooks.onEscape()) event.preventDefault();
      return;
    }
    const id = this.buttonId(event.target);
    const at = id ? this.order.indexOf(id) : -1;
    const to = keyTarget(event.key, at, this.order.length - 1);
    if (at < 0 || to === undefined) return;
    event.preventDefault();
    if (to >= 0 && to < this.order.length && to !== at) {
      this.entryOf(this.order[to]).button.focus();
    }
  }

  private onFocusIn(event: FocusEvent) {
    const id = this.buttonId(event.target);
    if (!id) return this.hooks.onFocus(null);
    this.lastFocusedId = id;
    this.applyTabStops();
    this.hooks.onFocus(this.entries.get(id)?.orb ?? null);
  }

  private onFocusOut(event: FocusEvent) {
    const to = event.relatedTarget as Node | null;
    if (to && this.list.contains(to)) return;
    this.hooks.onFocus(null);
  }

  private onClick(event: MouseEvent) {
    const entry = this.entries.get(this.buttonId(event.target) ?? "");
    if (entry) this.hooks.onActivate(entry.orb, event);
  }
}
