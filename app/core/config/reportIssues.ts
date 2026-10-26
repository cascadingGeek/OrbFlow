import type { OrbDataIssue } from "../../types/types";

/**
 * Warns about skipped entries and hands them to the `onDataIssue` handler.
 * An error thrown by the handler is caught and logged, never rethrown.
 */
export function reportIssues(
  issues: OrbDataIssue[],
  handler: (issues: OrbDataIssue[]) => void,
) {
  if (issues.length === 0) return;
  console.warn(
    `OrbFlow: skipped ${issues.length} invalid data ${
      issues.length === 1 ? "entry" : "entries"
    }.`,
    issues,
  );
  try {
    handler(issues);
  } catch (error) {
    console.error("OrbFlow: onDataIssue handler threw.", error);
  }
}
