import { describe, expect, it } from "vitest";
import { createInMemoryKvStore } from "./kv-store";

describe("createInMemoryKvStore", () => {
  it("returns undefined for an unset key", async () => {
    const store = createInMemoryKvStore();
    expect(await store.get("missing")).toBeUndefined();
  });

  it("returns what was set", async () => {
    const store = createInMemoryKvStore();
    await store.set("k", "v");
    expect(await store.get("k")).toBe("v");
  });

  it("distinguishes a stored null from an unset key", async () => {
    const store = createInMemoryKvStore();
    await store.set("k", null);
    expect(await store.get("k")).toBeNull();
  });

  it("overwrites on second set", async () => {
    const store = createInMemoryKvStore();
    await store.set("k", "a");
    await store.set("k", "b");
    expect(await store.get("k")).toBe("b");
  });

  it("seeds from an initial map", async () => {
    const store = createInMemoryKvStore({ x: 1, y: null });
    expect(await store.get("x")).toBe(1);
    expect(await store.get("y")).toBeNull();
  });

  it("removes a key so get returns undefined again", async () => {
    const store = createInMemoryKvStore({ k: "v" });
    expect(await store.get("k")).toBe("v");
    await store.remove("k");
    expect(await store.get("k")).toBeUndefined();
  });

  it("remove is a no-op for a missing key", async () => {
    const store = createInMemoryKvStore();
    await store.remove("missing");
    expect(await store.get("missing")).toBeUndefined();
  });
});
