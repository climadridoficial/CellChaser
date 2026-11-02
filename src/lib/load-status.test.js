import { expect, test } from "bun:test";
import { loadFailureState } from "./load-status";

test("a failed radar request with rendered radar data is partial, not total failure", () => {
  expect(loadFailureState(true, 4)).toBe("partial");
});
test("a failed request without usable data remains a failure", () => {
  expect(loadFailureState(true, 0)).toBe("failed");
});
test("successful loads do not report a failure", () => {
  expect(loadFailureState(false, 4)).toBe("none");
});