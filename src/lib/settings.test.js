import { expect, test } from "bun:test";
import { DEFAULT_SETTINGS, migrateCompositeDefault } from "./settings";

test("AEMET OpenData is the default composite", () => {
  expect(DEFAULT_SETTINGS.composite).toBe("opendata");
});

test("the old fallback default moves to OpenData once", () => {
  expect(migrateCompositeDefault("opera-fallback", false)).toBe("opendata");
  expect(migrateCompositeDefault("opera-fallback", true)).toBe("opera-fallback");
});

test("explicit OPERA-only and off preferences remain selectable", () => {
  expect(migrateCompositeDefault("opera", false)).toBe("opera");
  expect(migrateCompositeDefault("off", false)).toBe("off");
});