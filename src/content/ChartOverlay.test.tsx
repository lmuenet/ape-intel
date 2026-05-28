import { render, cleanup, fireEvent } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChartOverlay } from "./ChartOverlay";

afterEach(cleanup);

describe("<ChartOverlay />", () => {
  it("renders nothing when isOpen is false", () => {
    const { container } = render(<ChartOverlay isOpen={false} ticker="AAPL" onClose={() => {}} />);
    expect(container.querySelector(".ape-intel-chart")).toBeNull();
  });

  it("renders nothing when ticker is null", () => {
    const { container } = render(<ChartOverlay isOpen ticker={null} onClose={() => {}} />);
    expect(container.querySelector(".ape-intel-chart")).toBeNull();
  });

  it("renders an iframe pointing at TradingView with the ticker substituted", () => {
    const { container } = render(<ChartOverlay isOpen ticker="AAPL" onClose={() => {}} />);
    const iframe = container.querySelector("iframe") as HTMLIFrameElement;
    expect(iframe).toBeTruthy();
    expect(iframe.src).toContain("https://s.tradingview.com/widgetembed/");
    expect(iframe.src).toContain("symbol=AAPL");
  });

  it("invokes onClose when the close button is clicked", () => {
    const onClose = vi.fn();
    const { container } = render(<ChartOverlay isOpen ticker="AAPL" onClose={onClose} />);
    fireEvent.click(container.querySelector(".ape-intel-chart__close")!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("invokes onClose when the scrim (not the iframe area) is clicked", () => {
    const onClose = vi.fn();
    const { container } = render(<ChartOverlay isOpen ticker="AAPL" onClose={onClose} />);
    fireEvent.click(container.querySelector(".ape-intel-chart")!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does NOT invoke onClose when the iframe area itself is clicked", () => {
    const onClose = vi.fn();
    const { container } = render(<ChartOverlay isOpen ticker="AAPL" onClose={onClose} />);
    fireEvent.click(container.querySelector(".ape-intel-chart__inner")!);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("invokes onClose on Escape key", () => {
    const onClose = vi.fn();
    render(<ChartOverlay isOpen ticker="AAPL" onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not listen for Escape when closed", () => {
    const onClose = vi.fn();
    render(<ChartOverlay isOpen={false} ticker="AAPL" onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });
});
