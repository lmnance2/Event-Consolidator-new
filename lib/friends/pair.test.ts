import { describe, it, expect } from "vitest";
import { orderedPair } from "./pair";

describe("orderedPair", () => {
  it("returns [a, b] when a < b lexicographically", () => {
    const [x, y] = orderedPair("aaa", "bbb");
    expect(x).toBe("aaa");
    expect(y).toBe("bbb");
  });

  it("returns [b, a] when a > b lexicographically (swaps to maintain order)", () => {
    const [x, y] = orderedPair("zzz", "aaa");
    expect(x).toBe("aaa");
    expect(y).toBe("zzz");
  });

  it("returns [a, b] when a === b (equal strings stay equal)", () => {
    const [x, y] = orderedPair("same", "same");
    expect(x).toBe("same");
    expect(y).toBe("same");
  });

  it("handles empty strings — empty string is lexicographically less than any non-empty string", () => {
    const [x, y] = orderedPair("abc", "");
    expect(x).toBe("");
    expect(y).toBe("abc");
  });
});
