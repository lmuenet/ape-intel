import { render, cleanup, fireEvent } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExternalLinksBar } from "./ExternalLinksBar";

afterEach(cleanup);

describe("<ExternalLinksBar />", () => {
  it("renders nothing when ticker is null", () => {
    const { container } = render(<ExternalLinksBar ticker={null} onTradingViewClick={() => {}} />);
    expect(container.querySelector(".ape-intel-links")).toBeNull();
  });

  it("renders nothing when ticker is undefined", () => {
    const { container } = render(<ExternalLinksBar ticker={undefined} onTradingViewClick={() => {}} />);
    expect(container.querySelector(".ape-intel-links")).toBeNull();
  });

  it("invokes onTradingViewClick when the TradingView button is clicked", () => {
    const onTradingViewClick = vi.fn();
    const { getByRole } = render(<ExternalLinksBar ticker="AAPL" onTradingViewClick={onTradingViewClick} />);
    fireEvent.click(getByRole("button", { name: /TradingView/i }));
    expect(onTradingViewClick).toHaveBeenCalledTimes(1);
  });

  it("renders a Quiver anchor with the corrected /stock/ path", () => {
    const { getByRole } = render(<ExternalLinksBar ticker="AAPL" onTradingViewClick={() => {}} />);
    const a = getByRole("link", { name: /Quiver/i }) as HTMLAnchorElement;
    expect(a.href).toBe("https://www.quiverquant.com/stock/AAPL/");
    expect(a.target).toBe("_blank");
    expect(a.rel).toContain("noopener");
    expect(a.rel).toContain("noreferrer");
  });
});
