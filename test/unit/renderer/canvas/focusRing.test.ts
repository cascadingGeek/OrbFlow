import { drawFocusRing } from "../../../../app/renderer/canvas/focusRing";

describe("drawFocusRing", () => {
  it("strokes a dark inner ring and a white outer ring around the bubble", () => {
    const arcs: number[][] = [];
    const strokes: string[] = [];
    const fake = {
      lineWidth: 0,
      strokeStyle: "",
      beginPath: jest.fn(),
      arc: (...a: number[]) => arcs.push(a),
      stroke: () => strokes.push(fake.strokeStyle),
    };
    const ctx = fake as unknown as CanvasRenderingContext2D;

    drawFocusRing(ctx, 10, 20, 40);

    expect(arcs).toEqual([
      [10, 20, 43, 0, Math.PI * 2],
      [10, 20, 45, 0, Math.PI * 2],
    ]);
    expect(strokes).toEqual(["#0a0e1a", "#ffffff"]);
    expect(ctx.lineWidth).toBe(2);
  });
});
