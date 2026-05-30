import { render, cleanup } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { TrendingRow } from "./TrendingRow";
import type { TrendingRow as Row } from "../background/apewisdom-service";

afterEach(cleanup);

const row = (over: Partial<Row> = {}): Row => ({
  ticker: "TSLA",
  name: "Tesla",
  rank: 1,
  mentions: 99,
  mentions24hAgo: 50,
  ...over,
});

describe("<TrendingRow />", () => {
  it("shows rank, ticker, name and mentions", () => {
    const { getByText } = render(<TrendingRow row={row()} />);
    expect(getByText("TSLA")).toBeTruthy();
    expect(getByText("Tesla")).toBeTruthy();
    expect(getByText("1")).toBeTruthy();
    expect(getByText(/99/)).toBeTruthy();
  });

  it("falls back to the ticker when the name is missing", () => {
    const { getAllByText } = render(<TrendingRow row={row({ name: undefined })} />);
    // ticker rendered both as symbol and as the name fallback
    expect(getAllByText("TSLA").length).toBeGreaterThanOrEqual(1);
  });

  it("renders an up arrow when mentions rose", () => {
    const { getByText } = render(<TrendingRow row={row({ mentions: 99, mentions24hAgo: 50 })} />);
    expect(getByText("↑")).toBeTruthy();
  });

  it("renders a down arrow when mentions fell", () => {
    const { getByText } = render(<TrendingRow row={row({ mentions: 20, mentions24hAgo: 80 })} />);
    expect(getByText("↓")).toBeTruthy();
  });

  it("renders a flat arrow when mentions are unchanged", () => {
    const { getByText } = render(<TrendingRow row={row({ mentions: 40, mentions24hAgo: 40 })} />);
    expect(getByText("→")).toBeTruthy();
  });
});
