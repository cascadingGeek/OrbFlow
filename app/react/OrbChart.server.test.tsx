/**
 * @jest-environment node
 */
import { renderToString } from "react-dom/server";
import { OrbChart } from "./OrbChart";

describe("<OrbChart> on the server (AC-1)", () => {
  it("renders one div with the class and style, no canvas, and no warning", () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    expect(typeof window).toBe("undefined");
    expect(typeof document).toBe("undefined");

    const html = renderToString(
      <OrbChart
        data={[{ id: "a", label: "A", value: 1 }]}
        className="c"
        style={{ height: 320 }}
      />,
    );

    expect(html).toBe('<div class="c" style="width:100%;height:320px"></div>');
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });
});
