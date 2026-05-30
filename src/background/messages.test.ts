import { describe, expect, it, vi } from "vitest";
import type { ApewisdomEntry } from "../lib/apewisdom";
import type { StockTwitsEntry } from "../lib/stocktwits";
import type { TradestieEntry } from "../lib/tradestie";
import type { NewsItem, EarningsDate } from "../lib/finnhub";
import type { Favourite } from "../lib/favourites";
import { handleMessage, type MessageHandlers } from "./messages";

const handlers = (
  overrides: Partial<MessageHandlers> = {},
): MessageHandlers => ({
  fetchTicker: vi.fn(),
  lookupApewisdom: vi.fn(),
  lookupTradestie: vi.fn(),
  lookupStockTwits: vi.fn(),
  lookupFinnhubNews: vi.fn(),
  lookupFinnhubEarnings: vi.fn(),
  toggleFavourite: vi.fn(),
  isFavourite: vi.fn(),
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
    const entry: ApewisdomEntry = { rank: 1, mentions: 1, mentions24hAgo: 1 };
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

  it("routes finnhub:news", async () => {
    const items: NewsItem[] = [{ headline: "h", source: "s", url: "u", datetime: 1, catalyst: "news" }];
    const lookupFinnhubNews = vi.fn().mockResolvedValue(items);
    await expect(
      handleMessage({ type: "finnhub:news", ticker: "AAPL" }, handlers({ lookupFinnhubNews })),
    ).resolves.toBe(items);
    expect(lookupFinnhubNews).toHaveBeenCalledWith("AAPL");
  });

  it("routes finnhub:earnings", async () => {
    const date: EarningsDate = { date: "2026-06-15", epsEstimate: 2.1 };
    const lookupFinnhubEarnings = vi.fn().mockResolvedValue(date);
    await expect(
      handleMessage({ type: "finnhub:earnings", ticker: "AAPL" }, handlers({ lookupFinnhubEarnings })),
    ).resolves.toBe(date);
    expect(lookupFinnhubEarnings).toHaveBeenCalledWith("AAPL");
  });

  it("routes favourites:toggle with isin and ticker", async () => {
    const toggleFavourite = vi.fn().mockResolvedValue(true);
    await expect(
      handleMessage({ type: "favourites:toggle", isin: "US1", ticker: "AAA" }, handlers({ toggleFavourite })),
    ).resolves.toBe(true);
    expect(toggleFavourite).toHaveBeenCalledWith({ isin: "US1", ticker: "AAA" } satisfies Favourite);
  });

  it("routes favourites:has", async () => {
    const isFavourite = vi.fn().mockResolvedValue(false);
    await expect(
      handleMessage({ type: "favourites:has", isin: "US1" }, handlers({ isFavourite })),
    ).resolves.toBe(false);
    expect(isFavourite).toHaveBeenCalledWith("US1");
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
