import { PopLedger, type PopRecord } from "../../../../app/core/pop/PopLedger";

const record = (id: string, byUser = true): PopRecord => ({
  id,
  label: id,
  value: 1,
  x: 10,
  y: 20,
  placed: true,
  index: 0,
  byUser,
});

describe("PopLedger (spec 0006 AC-9)", () => {
  it("keeps records in pop order and takes them out by id", () => {
    const ledger = new PopLedger();
    ledger.remember(record("a"));
    ledger.remember(record("b"));
    ledger.remember(record("c"));

    expect(ledger.all().map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(ledger.take("b")?.id).toBe("b");
    expect(ledger.take("b")).toBeUndefined();
    expect(ledger.get("a")?.id).toBe("a");
    expect(ledger.all().map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("separates the records a user popped from the ones code popped", () => {
    const ledger = new PopLedger();
    ledger.remember(record("a", true));
    ledger.remember(record("b", false));

    expect(ledger.byUser().map((r) => r.id)).toEqual(["a"]);
  });

  it("moves a record popped again to the end, and clears", () => {
    const ledger = new PopLedger();
    ledger.remember(record("a"));
    ledger.remember(record("b"));
    ledger.remember(record("a"));
    expect(ledger.all().map((r) => r.id)).toEqual(["b", "a"]);

    ledger.clear();
    expect(ledger.all()).toEqual([]);
  });
});
