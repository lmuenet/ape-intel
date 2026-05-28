import { render, cleanup, fireEvent } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ApewisdomEntry } from "../lib/apewisdom";
import type { StockTwitsEntry } from "../lib/stocktwits";
import { SidePanel } from "./SidePanel";

afterEach(cleanup);

const apewisdom = (o: Partial<ApewisdomEntry> = {}): ApewisdomEntry => ({
  rank: 5, mentions: 247, mentions24hAgo: 180, ...o,
});
const stocktwits = (o: Partial<StockTwitsEntry> = {}): StockTwitsEntry => ({
  bullish: 18, bearish: 4, totalMessages: 30, ...o,
});

const defaults = {
  isOpen: true,
  ticker: "AAPL" as string | null | undefined,
  apewisdom: apewisdom() as ApewisdomEntry | null | undefined,
  stocktwits: stocktwits() as StockTwitsEntry | null | undefined,
  onClose: () => {},
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
});
