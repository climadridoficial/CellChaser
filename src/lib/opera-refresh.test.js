import { expect, test } from "bun:test";
import { OPERA_REFRESH_MS, OPERA_POLL_OPTIONS } from "./opera-refresh";

test("automatic OPERA polling checks once every ten minutes, not every minute", () => {
  expect(OPERA_REFRESH_MS).toBe(600_000);
  expect(OPERA_POLL_OPTIONS.refetchInterval).toBe(600_000);
  expect(OPERA_POLL_OPTIONS.staleTime).toBe(600_000);
});

test("errors and browser focus/reconnect cannot add automatic OPERA checks", () => {
  expect(OPERA_POLL_OPTIONS.retry).toBe(false);
  expect(OPERA_POLL_OPTIONS.refetchOnWindowFocus).toBe(false);
  expect(OPERA_POLL_OPTIONS.refetchOnReconnect).toBe(false);
  expect(OPERA_POLL_OPTIONS.refetchOnMount).toBe(false);
});