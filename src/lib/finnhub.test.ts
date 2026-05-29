import { describe, expect, it, vi } from "vitest";
import { fetchCompanyNews } from "./finnhub";

const ok = (body: unknown): Response => new Response(JSON.stringify(body), { status: 200 });
const NOW = Date.parse("2026-05-29T12:00:00Z"); // to=2026-05-29, from=2026-05-22

describe("fetchCompanyNews", () => {
  it("requests company-news with token and a 7-day window", async () => {
    const fetchFn = vi.fn().mockResolvedValue(ok([]));
    await fetchCompanyNews("AAPL", "KEY", fetchFn, NOW);
    expect(fetchFn).toHaveBeenCalledWith(
      "https://finnhub.io/api/v1/company-news?symbol=AAPL&from=2026-05-22&to=2026-05-29&token=KEY",
    );
  });

  it("maps, sorts by datetime desc, caps at 5, and tags catalysts", async () => {
    const raw = [
      { headline: "Old news", source: "S", url: "u1", datetime: 100 },
      { headline: "Apple posts Q2 earnings beat", source: "Reuters", url: "u2", datetime: 300 },
      { headline: "Broadcom to acquire VMware", source: "WSJ", url: "u3", datetime: 200 },
      { headline: "A", source: "S", url: "u4", datetime: 400 },
      { headline: "B", source: "S", url: "u5", datetime: 350 },
      { headline: "C", source: "S", url: "u6", datetime: 250 },
    ];
    const result = await fetchCompanyNews("AAPL", "KEY", vi.fn().mockResolvedValue(ok(raw)), NOW);
    expect(result).toHaveLength(5);
    expect(result[0].datetime).toBe(400);
    expect(result.map((r) => r.url)).not.toContain("u1");
    expect(result.find((r) => r.url === "u2")!.catalyst).toBe("earnings");
    expect(result.find((r) => r.url === "u3")!.catalyst).toBe("m&a");
  });

  it("drops entries missing headline or url", async () => {
    const raw = [
      { source: "S", url: "u1", datetime: 100 },
      { headline: "Has no url", source: "S", datetime: 200 },
      { headline: "Good one", source: "S", url: "u3", datetime: 300 },
    ];
    const result = await fetchCompanyNews("AAPL", "KEY", vi.fn().mockResolvedValue(ok(raw)), NOW);
    expect(result).toHaveLength(1);
    expect(result[0].headline).toBe("Good one");
  });

  it("throws on non-2xx", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("nope", { status: 401 }));
    await expect(fetchCompanyNews("AAPL", "BAD", fetchFn, NOW)).rejects.toThrow(/401/);
  });
});
