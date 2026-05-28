import { render, cleanup, fireEvent } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ApewisdomEntry } from "../lib/apewisdom";
import { SidePanel } from "./SidePanel";

afterEach(cleanup);

const entry = (overrides: Partial<ApewisdomEntry> = {}): ApewisdomEntry => ({
  rank: 5,
  mentions: 247,
  mentions24hAgo: 180,
  sentimentScore: 72,
  ...overrides,
});

describe("<SidePanel />", () => {
  it("renders nothing when isOpen is false", () => {
    const { container } = render(
      <SidePanel
        isOpen={false}
        ticker="AAPL"
        apewisdom={entry()}
        onClose={() => {}}
      />,
    );
    expect(container.querySelector(".ape-intel-panel")).toBeNull();
  });

  it("renders the ticker as title when known", () => {
    const { getByText } = render(
      <SidePanel
        isOpen
        ticker="AAPL"
        apewisdom={entry()}
        onClose={() => {}}
      />,
    );
    expect(getByText("AAPL")).toBeTruthy();
  });

  it("shows a resolving message when ticker is undefined", () => {
    const { getByText } = render(
      <SidePanel
        isOpen
        ticker={undefined}
        apewisdom={undefined}
        onClose={() => {}}
      />,
    );
    expect(getByText(/Resolving/i)).toBeTruthy();
  });

  it("shows Apewisdom mentions, sentiment, rank and an up-arrow when trending up", () => {
    const { getByText } = render(
      <SidePanel
        isOpen
        ticker="AAPL"
        apewisdom={entry({ mentions: 247, mentions24hAgo: 180 })}
        onClose={() => {}}
      />,
    );
    expect(getByText(/247/)).toBeTruthy();
    expect(getByText(/72/)).toBeTruthy();
    expect(getByText(/#5/)).toBeTruthy();
    expect(getByText(/↑/)).toBeTruthy();
  });

  it("shows a down-arrow when trending down", () => {
    const { getByText } = render(
      <SidePanel
        isOpen
        ticker="AAPL"
        apewisdom={entry({ mentions: 100, mentions24hAgo: 200 })}
        onClose={() => {}}
      />,
    );
    expect(getByText(/↓/)).toBeTruthy();
  });

  it("shows a no-data message when apewisdom is null", () => {
    const { getByText } = render(
      <SidePanel
        isOpen
        ticker="AAPL"
        apewisdom={null}
        onClose={() => {}}
      />,
    );
    expect(getByText(/No Apewisdom data/i)).toBeTruthy();
  });

  it("invokes onClose when the close button is clicked", () => {
    const onClose = vi.fn();
    const { container } = render(
      <SidePanel
        isOpen
        ticker="AAPL"
        apewisdom={entry()}
        onClose={onClose}
      />,
    );
    const close = container.querySelector(".ape-intel-panel__close")!;
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
