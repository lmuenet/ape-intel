import { render, cleanup } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { TrendingSection } from "./TrendingSection";
import type { TrendingRow as Row } from "../background/apewisdom-service";

afterEach(cleanup);

const rows: Row[] = [
  { ticker: "TSLA", name: "Tesla", rank: 1, mentions: 99, mentions24hAgo: 50 },
  { ticker: "NVDA", name: "Nvidia", rank: 2, mentions: 80, mentions24hAgo: 80 },
  { ticker: "GME", name: "GameStop", rank: 3, mentions: 10, mentions24hAgo: 40 },
];

describe("<TrendingSection />", () => {
  it("renders one row per entry, in order", () => {
    const { getAllByRole } = render(<TrendingSection rows={rows} />);
    const items = getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0].textContent).toContain("TSLA");
    expect(items[2].textContent).toContain("GME");
  });
});
