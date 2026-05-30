import { render, cleanup } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import type { DailySnapshot } from "../lib/snapshot-history";
import { SparklineSection } from "./Sparkline";

afterEach(cleanup);

const rec = (date: string, mentions: number): DailySnapshot => ({ date, mentions, rank: null });

describe("<SparklineSection />", () => {
  it("shows Loading when history is undefined", () => {
    const { getByText } = render(<SparklineSection history={undefined} />);
    expect(getByText(/Loading/i)).toBeTruthy();
  });

  it("shows an error message when history is null", () => {
    const { getByText } = render(<SparklineSection history={null} />);
    expect(getByText(/Couldn't load momentum/i)).toBeTruthy();
  });

  it("shows a collecting message with the count when fewer than 2 points", () => {
    const { getByText } = render(<SparklineSection history={[rec("2026-05-30", 5)]} />);
    expect(getByText(/Collecting data \(1\/7\)/i)).toBeTruthy();
  });

  it("renders an SVG polyline and the current mentions when 2+ points", () => {
    const { container, getByText } = render(
      <SparklineSection history={[rec("2026-05-29", 5), rec("2026-05-30", 9)]} />,
    );
    expect(container.querySelector("polyline.ape-intel-spark__line")).toBeTruthy();
    expect(getByText(/9 mentions/i)).toBeTruthy();
  });
});
