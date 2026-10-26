import type { OrbDataInput, OrbDataIssue } from "../../types/types";

/** What `DataValidator.validate` hands back. */
interface ValidationResult {
  accepted: OrbDataInput[];
  issues: OrbDataIssue[];
  /** True when the input was not an array at all. */
  notArray: boolean;
}

/**
 * Pure. Turns raw input into accepted entries plus a list of issues. It checks
 * only `id`, `label`, and `value`.
 */
export class DataValidator {
  validate(raw: unknown): ValidationResult {
    if (!Array.isArray(raw))
      return { accepted: [], issues: [], notArray: true };

    const accepted: OrbDataInput[] = [];
    const issues: OrbDataIssue[] = [];
    const seen = new Set<string>();

    raw.forEach((entry: unknown, index) => {
      const issue = this.check(entry, index, seen);
      if (issue) {
        issues.push(issue);
        return;
      }
      const item = entry as OrbDataInput;
      seen.add(item.id);
      accepted.push(item);
    });

    return { accepted, issues, notArray: false };
  }

  private check(
    entry: unknown,
    index: number,
    seen: Set<string>,
  ): OrbDataIssue | null {
    const item = (
      typeof entry === "object" && entry !== null ? entry : {}
    ) as Record<string, unknown>;
    const { id, label, value } = item;

    if (typeof id !== "string" || id === "") {
      return typeof id === "string"
        ? { index, id, reason: "invalid-id" }
        : { index, reason: "invalid-id" };
    }
    if (typeof label !== "string")
      return { index, id, reason: "invalid-label" };
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      return { index, id, reason: "invalid-value" };
    }
    if (seen.has(id)) return { index, id, reason: "duplicate-id" };
    return null;
  }
}
