import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { aemetStormGrid } from "./storm-aemet-grid";
import { detectCells } from "./storm-tracking";
test("server AEMET extraction uses the calibrated crop without a browser canvas",()=>{
  const grid = aemetStormGrid("ma",new Uint8Array(readFileSync(new URL("./__fixtures__/aemet-ma-1710.gif",import.meta.url))));
  // Warped (rotation/stretch) into the corners' enclosing map box.
  expect(grid.width).toBeGreaterThan(480); expect(grid.height).toBeGreaterThan(460);
  expect(grid.bounds).toEqual([[38.01997,-6.58081],[42.141,-0.89539]]);
  expect([...grid.values].filter(Number.isFinite).length).toBeGreaterThan(0);
  expect(detectCells(grid).length).toBeLessThan(60);
});