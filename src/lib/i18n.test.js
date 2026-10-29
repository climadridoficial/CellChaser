import { expect, test } from "bun:test";
import { LANGUAGES, MESSAGES, translate } from "./i18n";

test("language switch offers Portuguese and the Iberian languages", () => {
  expect(LANGUAGES.map((l) => l.id)).toEqual(["es", "pt", "ca", "gl", "eu", "en"]);
  expect(translate("pt", "layers")).toBe("Camadas");
  expect(translate("eu", "live")).toBe("Zuzenean");
});

test("every message is translated into every offered language", () => {
  for (const row of Object.values(MESSAGES)) for (const l of LANGUAGES) expect(row[l.id].trim().length).toBeGreaterThan(0);
});