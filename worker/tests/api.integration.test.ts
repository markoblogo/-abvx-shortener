import { describe, expect, it } from "vitest";
import { WorkerEnv } from "../src/env";
import worker from "../src/index";

function createFakeKV() {
  const store = new Map<string, string | null>();
  return {
    async get(key: string): Promise<string | null> {
      return store.get(key) ?? null;
    },
    async put(key: string, value: string): Promise<void> {
      store.set(key, value);
    },
    async delete(key: string): Promise<void> {
      store.delete(key);
    },
  };
}

describe("ABVX shortener API", () => {
  it("supports shorten, read, update, redirect and soft-delete", async () => {
    const env = {
      LINKS: createFakeKV(),
      API_KEY: "secret",
      BASE_URL: "https://go.abvx.xyz",
      ALLOW_NO_ORIGIN: "true",
      RATE_LIMIT_MAX: "100",
    } as WorkerEnv;

    const shortenReq = new Request("https://go.abvx.xyz/api/shorten", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": "secret",
      },
      body: JSON.stringify({ url: "https://example.com/" }),
    });

    const shortenRes1 = await worker.fetch(shortenReq, env);
    expect(shortenRes1.status).toBe(200);
    const first = await shortenRes1.json();
    expect(first.alreadyExisted).toBe(false);

    const slug = first.slug;

    const shortenRes2 = await worker.fetch(shortenReq, env);
    expect(shortenRes2.status).toBe(200);
    const second = await shortenRes2.json();
    expect(second.slug).toBe(slug);
    expect(second.alreadyExisted).toBe(true);

    const getRes = await worker.fetch(
      new Request(`https://go.abvx.xyz/api/link/${slug}`, {
        method: "GET",
        headers: { "X-API-Key": "secret" },
      }),
      env,
    );
    expect(getRes.status).toBe(200);
    const got = await getRes.json();
    expect(got.slug).toBe(slug);
    expect(got.url).toBe("https://example.com");

    const updateRes = await worker.fetch(
      new Request(`https://go.abvx.xyz/api/link/${slug}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": "secret",
        },
        body: JSON.stringify({ url: "https://updated.example.com/path", overwrite: true }),
      }),
      env,
    );
    expect(updateRes.status).toBe(200);
    const updated = await updateRes.json();
    expect(updated.url).toBe("https://updated.example.com/path");

    const redirectRes = await worker.fetch(new Request(`https://go.abvx.xyz/${slug}`, { method: "GET" }), env);
    expect(redirectRes.status).toBe(302);
    expect(redirectRes.headers.get("location")).toBe("https://updated.example.com/path");

    const deleteRes = await worker.fetch(
      new Request(`https://go.abvx.xyz/api/link/${slug}`, {
        method: "DELETE",
        headers: {
          "X-API-Key": "secret",
        },
      }),
      env,
    );
    expect(deleteRes.status).toBe(200);

    const getAfterDelete = await worker.fetch(
      new Request(`https://go.abvx.xyz/api/link/${slug}`, {
        method: "GET",
        headers: { "X-API-Key": "secret" },
      }),
      env,
    );
    expect(getAfterDelete.status).toBe(404);
  });

  it("rate limits shorten requests", async () => {
    const env = {
      LINKS: createFakeKV(),
      API_KEY: "secret",
      BASE_URL: "https://go.abvx.xyz",
      ALLOW_NO_ORIGIN: "true",
      RATE_LIMIT_MAX: "1",
      RATE_LIMIT_WINDOW_SEC: "60",
    } as WorkerEnv;

    const req = (url: string) =>
      new Request("https://go.abvx.xyz/api/shorten", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": "secret",
          "CF-Connecting-IP": "127.0.0.1",
        },
        body: JSON.stringify({ url }),
      });

    const first = await worker.fetch(req("https://example.com/1"), env);
    const second = await worker.fetch(req("https://example.com/2"), env);

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
  });
});
