import { describe, expect, it } from "vitest";
import { createAppRepository } from "./repository";

describe("createAppRepository", () => {
  it("uses the local repository when no Firebase user is available", () => {
    expect(createAppRepository().mode).toBe("local");
  });
});
