import { render, cleanup } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { ExternalLinksBar } from "./ExternalLinksBar";

afterEach(cleanup);

describe("<ExternalLinksBar />", () => {
  it("renders nothing when ticker is null", () => {
    const { container } = render(<ExternalLinksBar ticker={null} />);
    expect(container.querySelector(".ape-intel-links")).toBeNull();
  });

  it("renders nothing when ticker is undefined", () => {
    const { container } = render(<ExternalLinksBar ticker={undefined} />);
    expect(container.querySelector(".ape-intel-links")).toBeNull();
  });

  it("renders TradingView and Quiver links with the ticker substituted", () => {
    const { getByRole } = render(<ExternalLinksBar ticker="AAPL" />);
    const tv = getByRole("link", { name: /TradingView/i }) as HTMLAnchorElement;
    const quiver = getByRole("link", { name: /Quiver/i }) as HTMLAnchorElement;
    expect(tv.href).toBe("https://www.tradingview.com/chart/?symbol=AAPL");
    expect(quiver.href).toBe("https://www.quiverquant.com/stocks/AAPL/");
  });

  it("opens external links in a new tab safely", () => {
    const { getAllByRole } = render(<ExternalLinksBar ticker="AAPL" />);
    for (const a of getAllByRole("link") as HTMLAnchorElement[]) {
      expect(a.target).toBe("_blank");
      expect(a.rel).toContain("noopener");
      expect(a.rel).toContain("noreferrer");
    }
  });
});
