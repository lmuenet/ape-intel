import { describe, expect, it, vi } from "vitest";
import type { ApewisdomEntry } from "../lib/apewisdom";
import type { StockTwitsEntry } from "../lib/stocktwits";
import type { TradestieEntry } from "../lib/tradestie";
import { handleMessage, type MessageHandlers } from "./messages";

const handlers = (
  overrides: Partial<MessageHandlers> = {},
): MessageHandlers => ({
  fetchTicker: vi.fn(),
  lookupApewisdom: vi.fn(),
  lookupTradestie: vi.fn(),
  lookupStockTwits: vi.fn(),
  ...overrides,
});

describe("handleMessage", () => {
  it("routes ticker:lookup", async () => {
    const fetchTicker = vi.fn().mockResolvedValue("AAPL");
    const h = handlers({ fetchTicker });
    await expect(
      handleMessage({ type: "ticker:lookup", isin: "US0378331005" }, h),
    ).resolves.toBe("AAPL");
    expect(fetchTicker).toHaveBeenCalledWith("US0378331005");
  });

  it("routes apewisdom:lookup", async () => {
    const entry: ApewisdomEntry = { rank: 1, mentions: 1, mentions24hAgo: 1, sentimentScore: 1 };
    const lookupApewisdom = vi.fn().mockResolvedValue(entry);
    await expect(
      handleMessage({ type: "apewisdom:lookup", ticker: "AAPL" }, handlers({ lookupApewisdom })),
    ).resolves.toBe(entry);
  });

  it("routes tradestie:lookup", async () => {
    const entry: TradestieEntry = { comments: 50, sentimentLabel: "Bullish", sentimentScore: 0.7 };
    const lookupTradestie = vi.fn().mockResolvedValue(entry);
    await expect(
      handleMessage({ type: "tradestie:lookup", ticker: "AAPL" }, handlers({ lookupTradestie })),
    ).resolves.toBe(entry);
  });

  it("routes stocktwits:lookup", async () => {
    const entry: StockTwitsEntry = { bullish: 5, bearish: 2, totalMessages: 7 };
    const lookupStockTwits = vi.fn().mockResolvedValue(entry);
    await expect(
      handleMessage({ type: "stocktwits:lookup", ticker: "AAPL" }, handlers({ lookupStockTwits })),
    ).resolves.toBe(entry);
  });

  it("propagates rejections from any branch", async () => {
    const lookupStockTwits = vi.fn().mockRejectedValue(new Error("boom"));
    await expect(
      handleMessage({ type: "stocktwits:lookup", ticker: "AAPL" }, handlers({ lookupStockTwits })),
    ).rejects.toThrow("boom");
  });

  it("returns undefined for unknown / malformed messages", () => {
    const h = handlers();
    expect(handleMessage(null, h)).toBeUndefined();
    expect(handleMessage("x", h)).toBeUndefined();
    expect(handleMessage({ type: "other" }, h)).toBeUndefined();
    expect(handleMessage({ type: "ticker:lookup" }, h)).toBeUndefined();
    expect(handleMessage({ type: "tradestie:lookup", ticker: 5 }, h)).toBeUndefined();
  });
});
