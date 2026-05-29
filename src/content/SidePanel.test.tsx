import { render, cleanup, fireEvent } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ApewisdomEntry } from "../lib/apewisdom";
import type { StockTwitsEntry } from "../lib/stocktwits";
import type { Aggregate } from "../lib/barometer";
import type { NewsItem, EarningsDate } from "../lib/finnhub";
import { SidePanel } from "./SidePanel";

afterEach(cleanup);

const apewisdom = (o: Partial<ApewisdomEntry> = {}): ApewisdomEntry => ({
  rank: 5, mentions: 247, mentions24hAgo: 180, ...o,
});
const stocktwits = (o: Partial<StockTwitsEntry> = {}): StockTwitsEntry => ({
  bullish: 18, bearish: 4, totalMessages: 30, ...o,
});

const fullAggregate: Aggregate = {
  barometer: { score: 0.7, label: "very-bullish", contributingSources: 1, totalConfidence: 1, lowConfidence: true },
  buzz: { level: "loud", mentions: 247 },
  trend: "flat",
};

const sampleNews: NewsItem[] = [
  { headline: "Acme posts record quarter", source: "Reuters", url: "https://example.com/a", datetime: 1747699200, catalyst: "earnings" },
];
const sampleEarnings: EarningsDate = { date: "2026-06-02", epsEstimate: 2.15 };

const defaults = {
  isOpen: true,
  ticker: "AAPL" as string | null | undefined,
  apewisdom: apewisdom() as ApewisdomEntry | null | undefined,
  stocktwits: stocktwits() as StockTwitsEntry | null | undefined,
  aggregate: fullAggregate as Aggregate | null | undefined,
  news: sampleNews as NewsItem[] | null | undefined,
  earnings: sampleEarnings as EarningsDate | null | undefined,
  finnhubKey: "fk-test" as string | null | undefined,
  onSaveKey: (_key: string) => {},
  onClose: () => {},
  onTradingViewClick: () => {},
};

describe("<SidePanel />", () => {
  it("renders nothing when isOpen is false", () => {
    const { container } = render(<SidePanel {...defaults} isOpen={false} />);
    expect(container.querySelector(".ape-intel-panel")).toBeNull();
  });

  it("renders the ticker as title", () => {
    const { getByText } = render(<SidePanel {...defaults} />);
    expect(getByText("AAPL")).toBeTruthy();
  });

  it("shows a resolving message when ticker is undefined", () => {
    const { getByText } = render(
      <SidePanel {...defaults} ticker={undefined} apewisdom={undefined} stocktwits={undefined} />,
    );
    expect(getByText(/Resolving/i)).toBeTruthy();
  });

  it("renders StockTwits prominently with bullish/bearish counts and a ratio", () => {
    const { getByText, container } = render(<SidePanel {...defaults} stocktwits={stocktwits({ bullish: 18, bearish: 4 })} />);
    expect(container.querySelector(".ape-intel-panel__source--stocktwits")).toBeTruthy();
    expect(getByText(/18/)).toBeTruthy();
    expect(getByText(/4\b/)).toBeTruthy();
    expect(getByText(/82%/)).toBeTruthy();
  });

  it("StockTwits shows no-data placeholder when null", () => {
    const { getByText } = render(<SidePanel {...defaults} stocktwits={null} />);
    expect(getByText(/No StockTwits data/i)).toBeTruthy();
  });

  it("renders Apewisdom mentions, rank, and trend arrow", () => {
    const { getByText } = render(<SidePanel {...defaults} apewisdom={apewisdom({ mentions: 247, mentions24hAgo: 180 })} />);
    expect(getByText(/247/)).toBeTruthy();
    expect(getByText(/#5/)).toBeTruthy();
    expect(getByText(/↑/)).toBeTruthy();
  });

  it("Apewisdom shows no-data placeholder when null", () => {
    const { getByText } = render(<SidePanel {...defaults} apewisdom={null} />);
    expect(getByText(/No Apewisdom data/i)).toBeTruthy();
  });

  it("invokes onClose when close button clicked", () => {
    const onClose = vi.fn();
    const { container } = render(<SidePanel {...defaults} onClose={onClose} />);
    fireEvent.click(container.querySelector(".ape-intel-panel__close")!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders the Barometer headline label and score", () => {
    const { getByText, container } = render(<SidePanel {...defaults} />);
    expect(container.querySelector(".ape-intel-panel__barometer")).toBeTruthy();
    expect(getByText("Very Bullish")).toBeTruthy();
    expect(getByText("+0.70")).toBeTruthy();
  });

  it("shows a low-confidence note with the source count", () => {
    const { getByText } = render(<SidePanel {...defaults} />);
    expect(getByText(/low confidence · 1 source/i)).toBeTruthy();
  });

  it("shows 'No sentiment data' and no low-confidence note when unavailable", () => {
    const unavailable: Aggregate = {
      barometer: { score: null, label: "unavailable", contributingSources: 0, totalConfidence: 0, lowConfidence: true },
      buzz: { level: "none", mentions: null },
      trend: "unknown",
    };
    const { getByText, queryByText } = render(<SidePanel {...defaults} aggregate={unavailable} />);
    expect(getByText(/No sentiment data/i)).toBeTruthy();
    expect(queryByText(/low confidence/i)).toBeNull();
  });

  it("shows Loading in the Barometer section when aggregate is undefined", () => {
    const { container } = render(<SidePanel {...defaults} aggregate={undefined} />);
    const section = container.querySelector(".ape-intel-panel__barometer")!;
    expect(section.textContent).toMatch(/Loading/i);
  });

  it("shows a no-data message in the Barometer section when aggregate is null", () => {
    const { container } = render(<SidePanel {...defaults} aggregate={null} />);
    const section = container.querySelector(".ape-intel-panel__barometer")!;
    expect(section.textContent).toMatch(/No Barometer data/i);
  });

  it("renders the next-earnings row when a key is present", () => {
    const { getByText } = render(<SidePanel {...defaults} />);
    expect(getByText(/2026-06-02/)).toBeTruthy();
    expect(getByText(/EPS est\. 2\.15/)).toBeTruthy();
  });

  it("renders the news headline as a link", () => {
    const { getByText } = render(<SidePanel {...defaults} />);
    expect(getByText("Acme posts record quarter")).toBeTruthy();
  });

  it("shows the key input and hides the earnings row when no key", () => {
    const { getByPlaceholderText, queryByText } = render(
      <SidePanel {...defaults} finnhubKey={null} />,
    );
    expect(getByPlaceholderText("Finnhub API key")).toBeTruthy();
    expect(queryByText(/Next earnings/i)).toBeNull();
  });

  it("hides News and Earnings for an unresolved (uncovered) ticker", () => {
    const { queryByText, queryByPlaceholderText } = render(
      <SidePanel {...defaults} ticker={null} />,
    );
    expect(queryByText(/Next earnings/i)).toBeNull();
    expect(queryByText("News")).toBeNull();
    expect(queryByPlaceholderText("Finnhub API key")).toBeNull();
  });
});
