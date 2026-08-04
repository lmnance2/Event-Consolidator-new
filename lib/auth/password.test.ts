import { describe, it, expect } from "vitest";
import { passwordSchema, hashPassword, verifyPassword } from "./password";

describe("passwordSchema", () => {
  it("accepts a valid password with letter and number", () => {
    const result = passwordSchema.safeParse("ValidPass1");
    expect(result.success).toBe(true);
  });

  it("accepts a password that meets minimum length exactly", () => {
    const result = passwordSchema.safeParse("abcdef1x");
    expect(result.success).toBe(true);
  });

  it("rejects a password that is too short", () => {
    const result = passwordSchema.safeParse("Ab1");
    expect(result.success).toBe(false);
  });

  it("rejects a password with no letters", () => {
    const result = passwordSchema.safeParse("12345678");
    expect(result.success).toBe(false);
  });

  it("rejects a password with no numbers", () => {
    const result = passwordSchema.safeParse("abcdefgh");
    expect(result.success).toBe(false);
  });

  it("rejects an empty string", () => {
    const result = passwordSchema.safeParse("");
    expect(result.success).toBe(false);
  });
});

describe("hashPassword / verifyPassword", () => {
  it("round-trips: verifyPassword returns true for the original plain text", async () => {
    const plain = "MySecret1";
    const hash = await hashPassword(plain);
    expect(typeof hash).toBe("string");
    expect(hash.startsWith("$2")).toBe(true);
    const valid = await verifyPassword(plain, hash);
    expect(valid).toBe(true);
  }, 30000);

  it("verifyPassword returns false for a wrong password", async () => {
    const hash = await hashPassword("CorrectHorse1");
    const valid = await verifyPassword("WrongPassword2", hash);
    expect(valid).toBe(false);
  }, 30000);

  it("produces different hashes for the same input (salt uniqueness)", async () => {
    const hash1 = await hashPassword("SamePassword1");
    const hash2 = await hashPassword("SamePassword1");
    expect(hash1).not.toBe(hash2);
  }, 60000);
});
