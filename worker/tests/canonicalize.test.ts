import { describe, expect, it } from "vitest";
import { canonicalizeUrl } from "../src/validation/url";
import type { WorkerEnv } from "../src/env";

const env = {
  API_KEY: "key",
  BASE_URL: "https://go.abvx.xyz",
} as WorkerEnv;

describe("canonicalizeUrl", () => {
  it("normalizes case and strips trailing slash", () => {
    const value = canonicalizeUrl("HTTPS://Example.COM/Path/?a=1#frag", env, {
      stripTrailingSlash: true,
      maxLength: 2048,
    });
    expect(value.startsWith("https://example.com/Path/?a=1")).toBe(true);
  });

  it("rejects javascript scheme", () => {
    expect(() => canonicalizeUrl("javascript:alert(1)", env, { maxLength: 2048 })).toThrowError();
  });

  it("rejects localhost", () => {
    expect(() => canonicalizeUrl("http://127.0.0.1/test", env, { maxLength: 2048 })).toThrowError();
  });

  it("rejects credentials in URL", () => {
    expect(() => canonicalizeUrl("https://user:pass@example.com", env, { maxLength: 2048 })).toThrowError();
  });
});
