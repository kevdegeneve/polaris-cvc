import { describe, expect, it } from "vitest";
import { assertCompanyAccess, assertCompanyIdUnchanged, hasCompanyAccess } from "./companyAccess";

describe("company access guards", () => {
  it("allows access only when company ids match", () => {
    expect(hasCompanyAccess("company-a", "company-a")).toBe(true);
    expect(hasCompanyAccess("company-a", "company-b")).toBe(false);
    expect(hasCompanyAccess(undefined, "company-a")).toBe(false);
  });

  it("throws when an entity belongs to another company", () => {
    expect(() => assertCompanyAccess("company-a", { companyId: "company-b" })).toThrow("Acces refuse");
  });

  it("forbids companyId mutation", () => {
    expect(() => assertCompanyIdUnchanged("company-a", "company-b")).toThrow("companyId");
    expect(() => assertCompanyIdUnchanged("company-a", "company-a")).not.toThrow();
  });
});
