/** Finds the container element from an element or a CSS selector. */
export function resolveContainer(container: HTMLElement | string): HTMLElement {
  if (typeof container !== "string") return container;
  const el = document.querySelector<HTMLElement>(container);
  if (!el) throw new Error(`Container "${container}" not found`);
  return el;
}
