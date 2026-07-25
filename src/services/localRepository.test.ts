import { describe, expect, it } from "vitest";
import { createEmptyData } from "./localRepository";

describe("createEmptyData", () => {
  it("does not create demonstration business data", () => {
    const data = createEmptyData("company-a", "Entreprise reelle");

    expect(data.company).toMatchObject({ id: "company-a", name: "Entreprise reelle" });
    expect(data.users).toEqual([]);
    expect(data.customers).toEqual([]);
    expect(data.sites).toEqual([]);
    expect(data.equipment).toEqual([]);
    expect(data.interventions).toEqual([]);
    expect(data.diagnostics).toEqual([]);
    expect(data.documents).toEqual([]);
    expect(data.aiAnalyses).toEqual([]);
  });
});
