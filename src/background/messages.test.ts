import { describe, expect, it, vi } from "vitest";
import { handleMessage } from "./messages";

describe("handleMessage", () => {
  it("delegates ticker:lookup to fetchTicker and returns its promise", async () => {
    const fetchTicker = vi.fn().mockResolvedValue("AAPL");
    const result = handleMessage(
      { type: "ticker:lookup", isin: "US0378331005" },
      fetchTicker,
    );

    expect(result).toBeInstanceOf(Promise);
    await expect(result).resolves.toBe("AAPL");
    expect(fetchTicker).toHaveBeenCalledWith("US0378331005");
  });

  it("propagates fetcher rejections", async () => {
    const fetchTicker = vi.fn().mockRejectedValue(new Error("OpenFIGI returned 429"));
    await expect(
      handleMessage({ type: "ticker:lookup", isin: "US0378331005" }, fetchTicker),
    ).rejects.toThrow("429");
  });

  it("returns undefined for unknown message types", () => {
    const fetchTicker = vi.fn();
    expect(handleMessage({ type: "something:else" }, fetchTicker)).toBeUndefined();
    expect(fetchTicker).not.toHaveBeenCalled();
  });

  it("returns undefined for non-object / nullish messages", () => {
    const fetchTicker = vi.fn();
    expect(handleMessage(null, fetchTicker)).toBeUndefined();
    expect(handleMessage("hello", fetchTicker)).toBeUndefined();
    expect(handleMessage(undefined, fetchTicker)).toBeUndefined();
    expect(fetchTicker).not.toHaveBeenCalled();
  });
});
