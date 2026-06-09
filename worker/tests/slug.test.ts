import { describe, expect, it } from "vitest";
import { sha256Base32 } from "../src/slug/generator";

describe("slug generation", () => {
  it("is deterministic", async () => {
    const first = await sha256Base32("https://example.com/path");
    const second = await sha256Base32("https://example.com/path");
    const third = await sha256Base32("https://example.com/other");

    expect(first).toBe(second);
    expect(first).not.toBe(third);
    expect(first.length).toBeGreaterThan(20);
  });
});
