import { describe, expect, it, vi } from "vitest";
import type { ApewisdomEntry } from "../lib/apewisdom";
import type { StockTwitsEntry } from "../lib/stocktwits";
import type { TradestieEntry } from "../lib/tradestie";
import type { NewsItem, EarningsDate } from "../lib/finnhub";
import type { Favourite } from "../lib/favourites";
import type { DailySnapshot } from "../lib/snapshot-history";
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
  getSnapshotHistory: vi.fn(),
  getTrendingBoard: vi.fn(),
  getFavouritesBoard: vi.fn(),
  appendLog: vi.fn(),
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
    expect(lookupFinnhubNews).toHaveBeenCalledWith("AAPL", undefined);
  });

  it("routes finnhub:earnings", async () => {
    const date: EarningsDate = { date: "2026-06-15", epsEstimate: 2.1 };
    const lookupFinnhubEarnings = vi.fn().mockResolvedValue(date);
    await expect(
      handleMessage({ type: "finnhub:earnings", ticker: "AAPL" }, handlers({ lookupFinnhubEarnings })),
    ).resolves.toBe(date);
    expect(lookupFinnhubEarnings).toHaveBeenCalledWith("AAPL", undefined);
  });

  it("threads force through the four per-asset lookups", async () => {
    const lookupApewisdom = vi.fn().mockResolvedValue(null);
    const lookupStockTwits = vi.fn().mockResolvedValue(null);
    const lookupFinnhubNews = vi.fn().mockResolvedValue(null);
    const lookupFinnhubEarnings = vi.fn().mockResolvedValue(null);
    const h = handlers({ lookupApewisdom, lookupStockTwits, lookupFinnhubNews, lookupFinnhubEarnings });

    await handleMessage({ type: "apewisdom:lookup", ticker: "AAPL", force: true }, h);
    await handleMessage({ type: "stocktwits:lookup", ticker: "AAPL", force: true }, h);
    await handleMessage({ type: "finnhub:news", ticker: "AAPL", force: true }, h);
    await handleMessage({ type: "finnhub:earnings", ticker: "AAPL", force: true }, h);

    expect(lookupApewisdom).toHaveBeenCalledWith("AAPL", true);
    expect(lookupStockTwits).toHaveBeenCalledWith("AAPL", true);
    expect(lookupFinnhubNews).toHaveBeenCalledWith("AAPL", true);
    expect(lookupFinnhubEarnings).toHaveBeenCalledWith("AAPL", true);
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

  it("routes snapshot:history", async () => {
    const history: DailySnapshot[] = [{ date: "2026-05-30", mentions: 5, rank: 1 }];
    const getSnapshotHistory = vi.fn().mockResolvedValue(history);
    await expect(
      handleMessage({ type: "snapshot:history", isin: "US1" }, handlers({ getSnapshotHistory })),
    ).resolves.toBe(history);
    expect(getSnapshotHistory).toHaveBeenCalledWith("US1");
  });

  it("routes trending:board", async () => {
    const rows = [{ ticker: "AAPL", name: "Apple", rank: 1, mentions: 9, mentions24hAgo: 5 }];
    const getTrendingBoard = vi.fn().mockResolvedValue(rows);
    await expect(
      handleMessage({ type: "trending:board" }, handlers({ getTrendingBoard })),
    ).resolves.toBe(rows);
    expect(getTrendingBoard).toHaveBeenCalledTimes(1);
  });

  it("routes favourites:board", async () => {
    const rows = [{ isin: "US1", ticker: "AAPL", standing: null, history: [] }];
    const getFavouritesBoard = vi.fn().mockResolvedValue(rows);
    await expect(
      handleMessage({ type: "favourites:board" }, handlers({ getFavouritesBoard })),
    ).resolves.toBe(rows);
    expect(getFavouritesBoard).toHaveBeenCalledTimes(1);
  });

  it("routes a log entry to the buffer", async () => {
    const entry = { ts: 1, level: "warn" as const, context: "content" as const, message: "x" };
    const appendLog = vi.fn().mockResolvedValue(undefined);
    await handleMessage({ type: "log", entry }, handlers({ appendLog }));
    expect(appendLog).toHaveBeenCalledWith(entry);
  });

  it("returns undefined for unknown / malformed messages", () => {
    const h = handlers();
    expect(handleMessage(null, h)).toBeUndefined();
    expect(handleMessage("x", h)).toBeUndefined();
    expect(handleMessage({ type: "other" }, h)).toBeUndefined();
    expect(handleMessage({ type: "ticker:lookup" }, h)).toBeUndefined();
    expect(handleMessage({ type: "tradestie:lookup", ticker: 5 }, h)).toBeUndefined();
    expect(handleMessage({ type: "log" }, h)).toBeUndefined();
  });
});
