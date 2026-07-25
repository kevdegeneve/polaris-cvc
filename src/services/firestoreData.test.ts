import { describe, expect, it } from "vitest";
import { assertValidPreferredLanguage, removeUndefinedFields } from "./firestoreData";

describe("firestoreData", () => {
  it("removes undefined values before Firestore writes", () => {
    expect(
      removeUndefinedFields({
        name: "Polaris",
        optional: undefined,
        nested: {
          kept: true,
          removed: undefined
        },
        items: ["ok", undefined, { value: undefined, kept: "yes" }]
      })
    ).toEqual({
      name: "Polaris",
      nested: { kept: true },
      items: ["ok", { kept: "yes" }]
    });
  });

  it("accepts only supported preferred languages", () => {
    expect(() => assertValidPreferredLanguage("fr")).not.toThrow();
    expect(() => assertValidPreferredLanguage(undefined)).toThrow("Langue de travail invalide.");
    expect(() => assertValidPreferredLanguage("jp")).toThrow("Langue de travail invalide.");
  });
});
