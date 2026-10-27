import { DataValidator } from "@/core/config/DataValidator";

describe("DataValidator", () => {
  const validator = new DataValidator();
  const ok = { id: "a", label: "A", value: 1 };

  it("accepts good entries in input order, including a value of 0", () => {
    const { accepted, issues } = validator.validate([
      ok,
      { id: "b", label: "B", value: 0 },
    ]);

    expect(accepted.map((item) => item.id)).toEqual(["a", "b"]);
    expect(issues).toEqual([]);
  });

  it("reports each kind of bad entry with its index", () => {
    const { accepted, issues } = validator.validate([
      null,
      { id: "", label: "x", value: 1 },
      { id: "c", label: 5, value: 1 },
      { id: "d", label: "D", value: NaN },
      { id: "e", label: "E", value: -1 },
      { id: "f", label: "F", value: "3" },
      { id: "g", label: "G", value: Infinity },
    ]);

    expect(accepted).toEqual([]);
    expect(issues).toEqual([
      { index: 0, reason: "invalid-id" },
      { index: 1, id: "", reason: "invalid-id" },
      { index: 2, id: "c", reason: "invalid-label" },
      { index: 3, id: "d", reason: "invalid-value" },
      { index: 4, id: "e", reason: "invalid-value" },
      { index: 5, id: "f", reason: "invalid-value" },
      { index: 6, id: "g", reason: "invalid-value" },
    ]);
  });

  it("keeps the first of two entries that share an id", () => {
    const { accepted, issues } = validator.validate([
      ok,
      { ...ok, label: "second" },
    ]);

    expect(accepted).toEqual([ok]);
    expect(issues).toEqual([{ index: 1, id: "a", reason: "duplicate-id" }]);
  });

  it("lets a later entry use an id whose first entry was skipped", () => {
    const { accepted } = validator.validate([
      { id: "a", label: "A", value: NaN },
      ok,
    ]);

    expect(accepted).toEqual([ok]);
  });

  it("treats a non array as an empty list", () => {
    expect(validator.validate(undefined)).toEqual({
      accepted: [],
      issues: [],
      notArray: true,
    });
  });
});
