import { describe, expect, it } from "vitest";
import { createInMemoryKvStore } from "../lib/kv-store";
import type { LogEntry } from "../lib/logger";
import { createLogService, LOG_BUFFER_KEY } from "./log-service";

const entry = (n: number): LogEntry => ({
  ts: n,
  level: "warn",
  context: "content",
  message: `m${n}`,
});

describe("createLogService", () => {
  it("read returns an empty array when nothing is logged", async () => {
    const service = createLogService(createInMemoryKvStore());
    expect(await service.read()).toEqual([]);
  });

  it("persists appended entries under the buffer key, in order", async () => {
    const store = createInMemoryKvStore();
    const service = createLogService(store);
    await service.append(entry(1));
    await service.append(entry(2));
    expect(await service.read()).toEqual([entry(1), entry(2)]);
    expect(await store.get(LOG_BUFFER_KEY)).toEqual([entry(1), entry(2)]);
  });

  it("caps the buffer at 500 entries, dropping the oldest (FIFO)", async () => {
    const service = createLogService(createInMemoryKvStore());
    for (let i = 1; i <= 505; i++) await service.append(entry(i));
    const buf = await service.read();
    expect(buf).toHaveLength(500);
    expect(buf[0]).toEqual(entry(6)); // 1..5 dropped
    expect(buf[499]).toEqual(entry(505));
  });

  it("serializes concurrent appends without losing entries", async () => {
    const service = createLogService(createInMemoryKvStore());
    await Promise.all(Array.from({ length: 50 }, (_, i) => service.append(entry(i + 1))));
    expect(await service.read()).toHaveLength(50);
  });

  it("clear empties the buffer", async () => {
    const service = createLogService(createInMemoryKvStore());
    await service.append(entry(1));
    await service.clear();
    expect(await service.read()).toEqual([]);
  });
});
