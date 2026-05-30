import { render, cleanup } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { FavouritesSection } from "./FavouritesSection";
import type { FavouriteRow as Row } from "../background/favourites-board";

afterEach(cleanup);

const rows: Row[] = [
  { isin: "US1", ticker: "AAPL", standing: null, history: [] },
  { isin: "US2", ticker: "TSLA", standing: null, history: [] },
];

describe("<FavouritesSection />", () => {
  it("renders one row per favourite, in order", () => {
    const { getAllByRole } = render(<FavouritesSection rows={rows} />);
    const items = getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain("AAPL");
    expect(items[1].textContent).toContain("TSLA");
  });
});
