import { render, cleanup, fireEvent } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StoredStrategy } from "../lib/strategy";
import { StrategySection } from "./StrategySection";

afterEach(cleanup);

const stored = (o: Partial<StoredStrategy> = {}): StoredStrategy => ({
  direction: "long",
  timeframe: "2-4 weeks",
  targetPrice: "150",
  ingestedAt: "2026-05-30T14:00:00.000Z",
  ...o,
});

describe("<StrategySection />", () => {
  it("shows the paste form when there is no strategy", () => {
    const { getByPlaceholderText } = render(
      <StrategySection strategy={null} parseError={false} onSaveStrategy={vi.fn()} onClearStrategy={vi.fn()} />,
    );
    expect(getByPlaceholderText("Paste the AI's full answer here")).toBeTruthy();
  });

  it("calls onSaveStrategy with the trimmed textarea value on submit", () => {
    const onSaveStrategy = vi.fn();
    const { getByPlaceholderText, getByText } = render(
      <StrategySection strategy={null} parseError={false} onSaveStrategy={onSaveStrategy} onClearStrategy={vi.fn()} />,
    );
    fireEvent.input(getByPlaceholderText("Paste the AI's full answer here"), { target: { value: "  raw answer  " } });
    fireEvent.click(getByText("Save strategy"));
    expect(onSaveStrategy).toHaveBeenCalledWith("raw answer");
  });

  it("shows an error line when parseError is true", () => {
    const { getByText } = render(
      <StrategySection strategy={null} parseError onSaveStrategy={vi.fn()} onClearStrategy={vi.fn()} />,
    );
    expect(getByText(/Couldn't read a strategy/i)).toBeTruthy();
  });

  it("renders the strategy fields, direction and ingested time when present", () => {
    const { getByText, container } = render(
      <StrategySection strategy={stored()} parseError={false} onSaveStrategy={vi.fn()} onClearStrategy={vi.fn()} />,
    );
    expect(getByText("long")).toBeTruthy();
    expect(getByText("2-4 weeks")).toBeTruthy();
    expect(getByText("150")).toBeTruthy();
    expect(getByText(/Ingested 2026-05-30 14:00/)).toBeTruthy();
    expect(container.querySelector('.ape-intel-strategy__direction[data-direction="long"]')).toBeTruthy();
  });

  it("marks a short direction with the short data attribute", () => {
    const { container } = render(
      <StrategySection strategy={stored({ direction: "Short" })} parseError={false} onSaveStrategy={vi.fn()} onClearStrategy={vi.fn()} />,
    );
    expect(container.querySelector('.ape-intel-strategy__direction[data-direction="short"]')).toBeTruthy();
  });

  it("calls onClearStrategy when Clear is clicked", () => {
    const onClearStrategy = vi.fn();
    const { getByText } = render(
      <StrategySection strategy={stored()} parseError={false} onSaveStrategy={vi.fn()} onClearStrategy={onClearStrategy} />,
    );
    fireEvent.click(getByText("Clear"));
    expect(onClearStrategy).toHaveBeenCalledTimes(1);
  });

  it("shows Loading when strategy is undefined", () => {
    const { getByText } = render(
      <StrategySection strategy={undefined} parseError={false} onSaveStrategy={vi.fn()} onClearStrategy={vi.fn()} />,
    );
    expect(getByText(/Loading/i)).toBeTruthy();
  });
});
