import { render, cleanup, fireEvent } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NewsItem } from "../lib/finnhub";
import { NewsSection, EarningsRow } from "./NewsSection";

afterEach(cleanup);

const item = (o: Partial<NewsItem> = {}): NewsItem => ({
  headline: "Acme posts record quarter",
  source: "Reuters",
  url: "https://example.com/a",
  datetime: 1747699200, // 2025-05-20T00:00:00Z
  catalyst: "earnings",
  ...o,
});

describe("<NewsSection />", () => {
  it("shows a key input form when there is no key", () => {
    const onSaveKey = vi.fn();
    const { getByPlaceholderText, getByText } = render(
      <NewsSection hasKey={false} news={undefined} onSaveKey={onSaveKey} />,
    );
    const input = getByPlaceholderText("Finnhub API key") as HTMLInputElement;
    fireEvent.input(input, { target: { value: "  abc123  " } });
    fireEvent.click(getByText("Save"));
    expect(onSaveKey).toHaveBeenCalledWith("abc123");
  });

  it("shows Loading when key present and news is undefined", () => {
    const { getByText } = render(<NewsSection hasKey news={undefined} onSaveKey={vi.fn()} />);
    expect(getByText(/Loading/i)).toBeTruthy();
  });

  it("shows an error message when news is null", () => {
    const { getByText } = render(<NewsSection hasKey news={null} onSaveKey={vi.fn()} />);
    expect(getByText(/Couldn't load news/i)).toBeTruthy();
  });

  it("shows an empty message when there is no news", () => {
    const { getByText } = render(<NewsSection hasKey news={[]} onSaveKey={vi.fn()} />);
    expect(getByText(/No news in the last 7 days/i)).toBeTruthy();
  });

  it("renders headlines as links with a catalyst tag and date", () => {
    const { getByText, container } = render(
      <NewsSection hasKey news={[item()]} onSaveKey={vi.fn()} />,
    );
    const link = getByText("Acme posts record quarter") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("https://example.com/a");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(getByText("Earnings")).toBeTruthy();
    expect(getByText("2025-05-20")).toBeTruthy();
    expect(container.querySelector(".ape-intel-news__tag")).toBeTruthy();
  });
});

describe("<EarningsRow />", () => {
  it("shows Loading when undefined", () => {
    const { getByText } = render(<EarningsRow earnings={undefined} />);
    expect(getByText(/Loading/i)).toBeTruthy();
  });
  it("shows a no-date message when null", () => {
    const { getByText } = render(<EarningsRow earnings={null} />);
    expect(getByText(/No upcoming earnings/i)).toBeTruthy();
  });
  it("shows the date and EPS estimate when present", () => {
    const { getByText } = render(<EarningsRow earnings={{ date: "2026-06-15", epsEstimate: 2.1 }} />);
    expect(getByText(/2026-06-15/)).toBeTruthy();
    expect(getByText(/EPS est\. 2\.1/)).toBeTruthy();
  });
  it("omits the EPS estimate when null", () => {
    const { container, getByText } = render(<EarningsRow earnings={{ date: "2026-07-01", epsEstimate: null }} />);
    expect(getByText(/2026-07-01/)).toBeTruthy();
    expect(container.querySelector(".ape-intel-earnings__eps")).toBeNull();
  });
});
