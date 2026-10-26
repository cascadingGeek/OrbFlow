/**
 * @jest-environment jsdom
 */
import {
  HiddenText,
  buttonText,
  ensurePositioned,
  keyTarget,
  reorderChildren,
  survivorAfter,
} from "../../../../app/renderer/dom/listDom";
import type { Orb } from "../../../../app/types/types";
import { defined } from "../../../support/fakeDom";

const orb = (over: Partial<Orb> = {}): Orb => ({
  id: "a",
  label: "Alpha",
  value: 5,
  radius: 10,
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  ...over,
});

describe("buttonText (AC-2)", () => {
  it("reads label and value", () => {
    expect(buttonText(orb())).toBe("Alpha, value 5");
  });

  it("adds a truthy category", () => {
    expect(buttonText(orb({ metadata: { category: "Fruit" } }))).toBe(
      "Alpha, value 5, category Fruit",
    );
    expect(buttonText(orb({ metadata: { category: "" } }))).toBe(
      "Alpha, value 5",
    );
  });

  it("falls back to the id for an empty label", () => {
    expect(buttonText(orb({ label: "" }))).toBe("a, value 5");
  });
});

describe("reorderChildren", () => {
  const build = (ids: string[]) => {
    const parent = document.createElement("ul");
    const nodes = new Map(
      ids.map((id) => {
        const li = document.createElement("li");
        li.id = id;
        parent.appendChild(li);
        return [id, li] as const;
      }),
    );
    return { parent, nodes };
  };
  const ids = (parent: Element) => [...parent.children].map((el) => el.id);

  it("reorders and never moves the kept node", () => {
    const cases: [string[], string[], string][] = [
      [["f", "a", "b"], ["a", "f", "b"], "f"],
      [["a", "b", "f"], ["f", "a", "b"], "f"],
      [["f", "a", "b"], ["a", "b", "f"], "f"],
      [["g", "f", "a"], ["a", "f", "g"], "f"],
    ];
    for (const [current, desired, keep] of cases) {
      const { parent, nodes } = build(current);
      const keepNode = defined(nodes.get(keep));
      const moves: Node[] = [];
      const insert = parent.insertBefore.bind(parent);
      jest.spyOn(parent, "insertBefore").mockImplementation((node, ref) => {
        moves.push(node);
        return insert(node, ref);
      });
      reorderChildren(
        parent,
        desired.map((id) => defined(nodes.get(id))),
        keepNode,
      );
      expect(ids(parent)).toEqual(desired);
      expect(moves).not.toContain(keepNode);
    }
  });

  it("gives every permutation the right order", () => {
    const all = ["a", "b", "c", "d"];
    const permute = (rest: string[]): string[][] =>
      rest.length <= 1
        ? [rest]
        : rest.flatMap((x, i) =>
            permute([...rest.slice(0, i), ...rest.slice(i + 1)]).map((p) => [
              x,
              ...p,
            ]),
          );
    for (const from of permute(all)) {
      for (const to of permute(all)) {
        for (const keep of [undefined, "b"]) {
          const { parent, nodes } = build(from);
          reorderChildren(
            parent,
            to.map((id) => defined(nodes.get(id))),
            keep ? nodes.get(keep) : undefined,
          );
          // The kept node stays put, so only check the others' order.
          const got = ids(parent).filter((id) => id !== keep);
          expect(got).toEqual(to.filter((id) => id !== keep));
        }
      }
    }
  });
});

describe("survivorAfter and keyTarget (AC-3, AC-6)", () => {
  it("picks the next survivor, else the previous, else nothing", () => {
    const order = ["a", "b", "c", "d"];
    expect(survivorAfter(order, "b", new Set(["a", "c", "d"]))).toBe("c");
    expect(survivorAfter(order, "b", new Set(["a", "d"]))).toBe("d");
    expect(survivorAfter(order, "d", new Set(["a", "b"]))).toBe("b");
    expect(survivorAfter(order, "b", new Set())).toBeUndefined();
  });

  it("maps keys to indexes without wrapping", () => {
    expect(keyTarget("ArrowRight", 1, 3)).toBe(2);
    expect(keyTarget("ArrowDown", 1, 3)).toBe(2);
    expect(keyTarget("ArrowLeft", 1, 3)).toBe(0);
    expect(keyTarget("ArrowUp", 0, 3)).toBe(-1);
    expect(keyTarget("Home", 2, 3)).toBe(0);
    expect(keyTarget("End", 0, 3)).toBe(3);
    expect(keyTarget("a", 0, 3)).toBeUndefined();
  });
});

describe("ensurePositioned and HiddenText (AC-1, AC-11)", () => {
  it("sets relative only on a static container, and restores it", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const restore = ensurePositioned(container);
    expect(container.style.position).toBe("relative");
    restore();
    expect(container.style.position).toBe("");

    container.style.position = "absolute";
    ensurePositioned(container)();
    expect(container.style.position).toBe("absolute");
    container.remove();
  });

  it("creates the element for text and removes it for an empty string", () => {
    const container = document.createElement("div");
    const text = new HiddenText(container, () => "desc-1");
    expect(text.set("Hello")).toBe("desc-1");
    expect(container.querySelector("#desc-1")?.textContent).toBe("Hello");
    text.set("Changed");
    expect(container.querySelectorAll("span")).toHaveLength(1);
    expect(text.set("")).toBeNull();
    expect(container.children).toHaveLength(0);
  });
});
