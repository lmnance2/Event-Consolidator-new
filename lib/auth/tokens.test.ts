import { describe, it, expect } from "vitest";
import { generateToken, hashToken } from "./tokens";

describe("generateToken", () => {
  it("produces a 64-character hex string (32 bytes)", () => {
    const token = generateToken();
    expect(typeof token).toBe("string");
    expect(token).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(token)).toBe(true);
  });

  it("produces unique tokens on each call", () => {
    const tokens = new Set(Array.from({ length: 20 }, () => generateToken()));
    expect(tokens.size).toBe(20);
  });
});

describe("hashToken", () => {
  it("produces a 64-character hex string (sha256)", () => {
    const hash = hashToken("some-raw-token");
    expect(typeof hash).toBe("string");
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
  });

  it("is deterministic — same input yields same output", () => {
    const raw = "deterministic-input";
    expect(hashToken(raw)).toBe(hashToken(raw));
  });

  it("differs for different inputs", () => {
    expect(hashToken("input-a")).not.toBe(hashToken("input-b"));
  });

  it("differs from the raw token", () => {
    const raw = generateToken();
    expect(hashToken(raw)).not.toBe(raw);
  });
});
