/** A failed request does not mean independently loaded data disappeared. */
export function loadFailureState(failed: boolean, usableCount: number): "none" | "partial" | "failed" {
  return !failed ? "none" : usableCount > 0 ? "partial" : "failed";
}