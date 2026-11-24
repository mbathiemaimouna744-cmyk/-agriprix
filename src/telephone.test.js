import { describe, expect, it } from "vitest";
import { normaliserNumeroSenegal } from "./telephone";

describe("normaliserNumeroSenegal", () => {
  it("normalise un numéro local formaté", () => {
    expect(normaliserNumeroSenegal("77 123 45 67")).toBe("221771234567");
  });

  it("normalise un numéro avec le préfixe international +221", () => {
    expect(normaliserNumeroSenegal("+221 77 123 45 67")).toBe("221771234567");
  });

  it("normalise un numéro avec le préfixe international 00221", () => {
    expect(normaliserNumeroSenegal("00221 77 123 45 67")).toBe("221771234567");
  });
});
