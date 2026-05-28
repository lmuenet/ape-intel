import { describe, expect, it, vi } from "vitest";
import { fetchTickerFromOpenFigi } from "./openfigi";

const ok = (body: unknown): Response =>
  new Response(JSON.stringify(body), { status: 200 });

describe("fetchTickerFromOpenFigi", () => {
  it("posts to the OpenFIGI mapping endpoint with ID_ISIN + US exchCode", async () => {
    const fetchFn = vi.fn().mockResolvedValue(ok([{ data: [{ ticker: "AAPL" }] }]));
    await fetchTickerFromOpenFigi("US0378331005", fetchFn);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("https://api.openfigi.com/v3/mapping");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ "Content-Type": "application/json" });
    expect(JSON.parse(init.body)).toEqual([
      { idType: "ID_ISIN", idValue: "US0378331005", exchCode: "US" },
    ]);
  });

  it("returns the ticker from a successful mapping", async () => {
    const fetchFn = vi.fn().mockResolvedValue(ok([{ data: [{ ticker: "AAPL" }] }]));
    expect(await fetchTickerFromOpenFigi("US0378331005", fetchFn)).toBe("AAPL");
  });

  it("returns null when OpenFIGI warns no identifier found", async () => {
    const fetchFn = vi.fn().mockResolvedValue(ok([{ warning: "No identifier found." }]));
    expect(await fetchTickerFromOpenFigi("DE0007164600", fetchFn)).toBeNull();
  });

  it("returns null when data is empty", async () => {
    const fetchFn = vi.fn().mockResolvedValue(ok([{ data: [] }]));
    expect(await fetchTickerFromOpenFigi("XX0000000000", fetchFn)).toBeNull();
  });

  it("throws on non-2xx response", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response("rate limited", { status: 429 }),
    );
    await expect(
      fetchTickerFromOpenFigi("US0378331005", fetchFn),
    ).rejects.toThrow(/429/);
  });
});
