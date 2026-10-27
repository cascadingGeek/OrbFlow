import { reportIssues } from "@/core/config/reportIssues";
import type { OrbDataIssue } from "@/types/types";

describe("reportIssues", () => {
  const issue: OrbDataIssue = { index: 0, reason: "invalid-id" };

  beforeEach(() => {
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it("does nothing, and does not call the handler, with no issues", () => {
    const handler = jest.fn();

    reportIssues([], handler);

    expect(handler).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("warns once and hands the issues to the handler", () => {
    const handler = jest.fn();

    reportIssues([issue], handler);

    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      "OrbFlow: skipped 1 invalid data entry.",
      [issue],
    );
    expect(handler).toHaveBeenCalledWith([issue]);
  });

  it("uses the plural for several issues", () => {
    reportIssues([issue, { ...issue, index: 1 }], jest.fn());

    expect(console.warn).toHaveBeenCalledWith(
      "OrbFlow: skipped 2 invalid data entries.",
      expect.any(Array),
    );
  });

  it("catches and logs an error thrown by the handler", () => {
    const boom = new Error("boom");

    expect(() =>
      reportIssues([issue], () => {
        throw boom;
      }),
    ).not.toThrow();
    expect(console.error).toHaveBeenCalledWith(
      "OrbFlow: onDataIssue handler threw.",
      boom,
    );
  });
});
