import { render, cleanup, fireEvent } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App, type Send } from "./App";

afterEach(cleanup);

const pending = () => new Promise<never>(() => {});

// A send mock that serves both boards plus per-ticker intel lookups.
const boardSend = (): Send =>
  (vi.fn(async (m: { type: string; ticker?: string }) => {
    switch (m.type) {
      case "trending:board":
        return [
          { ticker: "TSLA", name: "Tesla", rank: 1, mentions: 99, mentions24hAgo: 50 },
          { ticker: "NVDA", name: "Nvidia", rank: 2, mentions: 80, mentions24hAgo: 70 },
        ];
      case "favourites:board":
        return [];
      case "stocktwits:lookup":
        return { bullish: 1, bearish: 1, totalMessages: 2 };
      default:
        return null;
    }
  }) as unknown as Send);

const noKey = async () => false;

describe("<App />", () => {
  it("renders both section headings", () => {
    const { getByText } = render(<App send={vi.fn().mockReturnValue(pending())} />);
    expect(getByText("Trending")).toBeTruthy();
    expect(getByText("Favourites")).toBeTruthy();
  });

  it("wraps both sections in a single columns container", () => {
    const { container } = render(<App send={vi.fn().mockReturnValue(pending())} />);
    const cols = container.querySelector(".ape-popup__cols");
    expect(cols).toBeTruthy();
    expect(cols?.querySelectorAll(".ape-popup__section").length).toBe(2);
  });

  it("shows a loading state in each section before data arrives", () => {
    const { getAllByText } = render(<App send={vi.fn().mockReturnValue(pending())} />);
    expect(getAllByText(/loading/i).length).toBe(2);
  });

  it("requests both boards on mount", () => {
    const send = vi.fn().mockResolvedValue([]);
    render(<App send={send} />);
    expect(send).toHaveBeenCalledWith({ type: "trending:board" });
    expect(send).toHaveBeenCalledWith({ type: "favourites:board" });
  });

  it("shows an empty hint in each section when boards come back empty", async () => {
    const { findByText } = render(<App send={vi.fn().mockResolvedValue([])} />);
    expect(await findByText(/nothing trending/i)).toBeTruthy();
    expect(await findByText(/no favourites/i)).toBeTruthy();
  });

  it("shows an error hint when a board lookup rejects", async () => {
    const send = vi.fn().mockRejectedValue(new Error("boom"));
    const { findAllByText } = render(<App send={send} />);
    expect((await findAllByText(/couldn/i)).length).toBe(2);
  });

  it("expands a trending row on click and fetches its intel", async () => {
    const send = boardSend();
    const { findByRole } = render(<App send={send} getHasFinnhubKey={noKey} />);
    const toggle = await findByRole("button", { name: /TSLA/ });
    fireEvent.click(toggle);
    expect(send).toHaveBeenCalledWith({ type: "stocktwits:lookup", ticker: "TSLA" });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
  });

  it("keeps only one row open at a time", async () => {
    const send = boardSend();
    const { findByRole } = render(<App send={send} getHasFinnhubKey={noKey} />);
    const tsla = await findByRole("button", { name: /TSLA/ });
    const nvda = await findByRole("button", { name: /NVDA/ });
    fireEvent.click(tsla);
    fireEvent.click(nvda);
    expect(tsla.getAttribute("aria-expanded")).toBe("false");
    expect(nvda.getAttribute("aria-expanded")).toBe("true");
  });

  it("does not fetch finnhub when no key is stored", async () => {
    const send = boardSend();
    const { findByRole } = render(<App send={send} getHasFinnhubKey={noKey} />);
    fireEvent.click(await findByRole("button", { name: /TSLA/ }));
    expect(send).not.toHaveBeenCalledWith({ type: "finnhub:news", ticker: "TSLA" });
  });

  it("applies a pasted challenge and overlays the verdict badge", async () => {
    const saveChallenge = vi.fn().mockResolvedValue(undefined);
    const { findByLabelText, getByRole, findByText } = render(
      <App send={boardSend()} getHasFinnhubKey={noKey} loadChallenge={async () => null} saveChallenge={saveChallenge} />,
    );
    fireEvent.input(await findByLabelText(/paste/i), {
      target: { value: '[{"ticker":"TSLA","verdict":"noise","thesis":"meme pump"}]' },
    });
    fireEvent.click(getByRole("button", { name: /apply/i }));
    expect(await findByText("Noise")).toBeTruthy();
    expect(await findByText("meme pump")).toBeTruthy();
    expect(saveChallenge).toHaveBeenCalledTimes(1);
  });

  it("flags staleness when the stored tickers differ from the board", async () => {
    const stored = {
      summary: "s",
      verdicts: [],
      ingestedAt: "2026-05-31T08:00:00.000Z",
      tickers: ["OLD"],
    };
    const { findByText } = render(
      <App send={boardSend()} getHasFinnhubKey={noKey} loadChallenge={async () => stored} />,
    );
    expect(await findByText(/board updated/i)).toBeTruthy();
  });
});
