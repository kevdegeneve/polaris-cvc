import { describe, expect, it } from "vitest";
import { createTranslator, getLanguageLabel, hasConfiguredLanguage, languageOptions, translate } from "./languageService";

describe("languageService", () => {
  it("detects whether a user has configured a supported language", () => {
    expect(hasConfiguredLanguage(undefined)).toBe(false);
    expect(hasConfiguredLanguage("")).toBe(false);
    expect(hasConfiguredLanguage("fr")).toBe(true);
    expect(hasConfiguredLanguage("jp")).toBe(false);
  });

  it("keeps supported language labels centralized", () => {
    expect(languageOptions.map((item) => item.value)).toEqual(["fr", "en", "de", "it", "es"]);
    expect(getLanguageLabel("fr")).toBe("Francais");
  });

  it("translates the main interface in every selectable language", () => {
    expect(translate("fr", "dashboard")).toBe("Tableau de bord");
    expect(translate("en", "dashboard")).toBe("Dashboard");
    expect(translate("de", "dashboard")).toBe("Uebersicht");
    expect(translate("it", "dashboard")).toBe("Cruscotto");
    expect(translate("es", "dashboard")).toBe("Panel");
  });

  it("keeps the selected language after reload through profile language", () => {
    const t = createTranslator("it");

    expect(t("loginTitle")).toBe("Accesso sicuro");
    expect(t("noDiagnosticArchive")).toBe("Nessuna diagnosi archiviata");
  });

  it("falls back to French when no language is configured", () => {
    expect(translate(undefined, "loginTitle")).toBe("Connexion securisee");
  });
});
