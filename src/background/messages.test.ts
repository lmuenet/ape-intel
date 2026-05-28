import { describe, expect, it, vi } from "vitest";
import type { ApewisdomEntry } from "../lib/apewisdom";
import { handleMessage } from "./messages";

const noopApewisdom = vi.fn();
const noopTicker = vi.fn();

describe("handleMessage", () => {
  it("delegates ticker:lookup to fetchTicker", async () => {
    const fetchTicker = vi.fn().mockResolvedValue("AAPL");
    const result = handleMessage(
      { type: "ticker:lookup", isin: "US0378331005" },
      fetchTicker,
      noopApewisdom,
    );
    expect(result).toBeInstanceOf(Promise);
    await expect(result).resolves.toBe("AAPL");
    expect(fetchTicker).toHaveBeenCalledWith("US0378331005");
  });

  it("delegates apewisdom:lookup to lookupApewisdom", async () => {
    const entry: ApewisdomEntry = {
      rank: 5,
      mentions: 100,
      mentions24hAgo: 80,
      sentimentScore: 60,
    };
    const lookupApewisdom = vi.fn().mockResolvedValue(entry);
    const result = handleMessage(
      { type: "apewisdom:lookup", ticker: "AAPL" },
      noopTicker,
      lookupApewisdom,
    );
    expect(result).toBeInstanceOf(Promise);
    await expect(result).resolves.toBe(entry);
    expect(lookupApewisdom).toHaveBeenCalledWith("AAPL");
  });

  it("propagates fetcher rejections (ticker)", async () => {
    const fetchTicker = vi.fn().mockRejectedValue(new Error("boom"));
    await expect(
      handleMessage(
        { type: "ticker:lookup", isin: "US0378331005" },
        fetchTicker,
        noopApewisdom,
      ),
    ).rejects.toThrow("boom");
  });

  it("propagates fetcher rejections (apewisdom)", async () => {
    const lookupApewisdom = vi.fn().mockRejectedValue(new Error("boom"));
    await expect(
      handleMessage(
        { type: "apewisdom:lookup", ticker: "AAPL" },
        noopTicker,
        lookupApewisdom,
      ),
    ).rejects.toThrow("boom");
  });

  it("returns undefined for unknown / malformed messages", () => {
    expect(handleMessage({ type: "other" }, noopTicker, noopApewisdom)).toBeUndefined();
    expect(handleMessage(null, noopTicker, noopApewisdom)).toBeUndefined();
    expect(handleMessage("x", noopTicker, noopApewisdom)).toBeUndefined();
    expect(handleMessage({ type: "ticker:lookup" }, noopTicker, noopApewisdom)).toBeUndefined();
    expect(handleMessage({ type: "apewisdom:lookup", ticker: 5 }, noopTicker, noopApewisdom)).toBeUndefined();
  });
});
