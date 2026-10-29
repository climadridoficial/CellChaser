import { expect, test } from "bun:test";
import { LANGUAGES, isLanguage } from "./i18n";

test("language switch offers Portuguese and the Iberian languages", () => {
  expect(LANGUAGES.map((l) => l.id)).toEqual(["es", "pt", "ca", "gl", "eu", "en"]);
});

test("saved language values accept Portuguese and reject unknown choices", () => {
  expect(isLanguage("pt")).toBe(true);
  expect(isLanguage("eu")).toBe(true);
  expect(isLanguage("unknown")).toBe(false);
  expect(isLanguage(null)).toBe(false);
});