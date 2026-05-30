import { render, cleanup } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { ExpandedIntel, type ExpandedIntelProps } from "./ExpandedIntel";

afterEach(cleanup);

const props = (over: Partial<ExpandedIntelProps> = {}): ExpandedIntelProps => ({
  ticker: "AAPL",
  apewisdom: { rank: 1, name: "Apple", mentions: 99, mentions24hAgo: 50 },
  stocktwits: { bullish: 8, bearish: 2, totalMessages: 10 },
  news: [{ headline: "Apple soars", source: "Reuters", url: "u1", datetime: 1, catalyst: "news" }],
  earnings: { date: "2026-06-15", epsEstimate: 2.1 },
  hasKey: true,
  ...over,
});

describe("<ExpandedIntel />", () => {
  it("shows a loading state while stocktwits is undefined", () => {
    const { getByText } = render(<ExpandedIntel {...props({ stocktwits: undefined })} />);
    expect(getByText(/loading/i)).toBeTruthy();
  });

  it("renders a bullish barometer for bull-heavy stocktwits", () => {
    const { getByText } = render(<ExpandedIntel {...props()} />);
    expect(getByText("Very Bullish")).toBeTruthy();
  });

  it("shows news when a key is present", () => {
    const { getByText } = render(<ExpandedIntel {...props()} />);
    expect(getByText("Apple soars")).toBeTruthy();
  });

  it("shows a key hint instead of news when no key is stored", () => {
    const { getByText, queryByText } = render(<ExpandedIntel {...props({ hasKey: false })} />);
    expect(getByText(/finnhub key/i)).toBeTruthy();
    expect(queryByText("Apple soars")).toBeNull();
  });

  it("links out to TradingView for the ticker", () => {
    const { getByText } = render(<ExpandedIntel {...props()} />);
    const link = getByText("TradingView") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toContain("AAPL");
  });
});
