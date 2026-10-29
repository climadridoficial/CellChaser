import { expect, test } from "bun:test";
import { runPool, sumProgress } from "./preload";

test("preload runs every frame, never more than the concurrency at once, and survives a failed frame", async () => {
  let active = 0;
  let peak = 0;
  let done = 0;
  const tasks = Array.from({ length: 10 }, (_, i) => async () => {
    active++;
    peak = Math.max(peak, active);
    await new Promise((r) => setTimeout(r, 2));
    active--;
    if (i === 4) throw new Error("missing frame");
  });
  await runPool(tasks, 3, () => done++, () => false);
  expect(done).toBe(10);
  expect(peak).toBe(3);
});

test("cancelled preload stops starting new frames", async () => {
  let started = 0;
  let cancel = false;
  const tasks = Array.from({ length: 10 }, () => async () => {
    started++;
    cancel = true;
  });
  await runPool(tasks, 1, () => {}, () => cancel);
  expect(started).toBe(1);
});

test("slider progress adds composite and station frames", () => {
  expect(sumProgress({ done: 3, total: 36 }, { done: 1, total: 36 })).toEqual({ done: 4, total: 72 });
});
