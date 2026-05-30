import { render, cleanup } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { FavouriteRow } from "./FavouriteRow";
import type { FavouriteRow as Row } from "../background/favourites-board";

afterEach(cleanup);

const history = (mentions: number, date: string) => ({ date, mentions, rank: 1 });

const row = (over: Partial<Row> = {}): Row => ({
  isin: "US1",
  ticker: "AAPL",
  standing: { rank: 5, name: "Apple", mentions: 99, mentions24hAgo: 50 },
  history: [history(10, "2026-05-29"), history(30, "2026-05-30")],
  ...over,
});

describe("<FavouriteRow />", () => {
  it("shows the ticker and current mentions when trending", () => {
    const { getByText } = render(<FavouriteRow row={row()} />);
    expect(getByText("AAPL")).toBeTruthy();
    expect(getByText(/99/)).toBeTruthy();
  });

  it("shows a not-trending hint when there is no current standing", () => {
    const { getByText } = render(<FavouriteRow row={row({ standing: null })} />);
    expect(getByText(/not trending/i)).toBeTruthy();
  });

  it("renders a sparkline when there are at least two history points", () => {
    const { getByRole } = render(<FavouriteRow row={row()} />);
    expect(getByRole("img")).toBeTruthy();
  });

  it("shows a collecting hint with fewer than two history points", () => {
    const { getByText } = render(<FavouriteRow row={row({ history: [history(10, "2026-05-30")] })} />);
    expect(getByText(/collecting/i)).toBeTruthy();
  });
});
