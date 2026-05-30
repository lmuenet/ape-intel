import { render, cleanup } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

afterEach(cleanup);

const pending = () => new Promise<never>(() => {});

describe("<App />", () => {
  it("renders both section headings", () => {
    const { getByText } = render(<App send={vi.fn().mockReturnValue(pending())} />);
    expect(getByText("Trending")).toBeTruthy();
    expect(getByText("Favourites")).toBeTruthy();
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
});
