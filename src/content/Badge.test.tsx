import { render, cleanup, fireEvent } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Badge } from "./Badge";

afterEach(cleanup);

describe("<Badge />", () => {
  it("renders the ISIN", () => {
    const { getByText } = render(<Badge isin="US0378331005" />);
    expect(getByText("US0378331005")).toBeTruthy();
  });

  it("renders the brand label", () => {
    const { getByText } = render(<Badge isin="US0378331005" />);
    expect(getByText(/Ape Intel/i)).toBeTruthy();
  });

  it("renders the ticker when provided", () => {
    const { getByText } = render(<Badge isin="US0378331005" ticker="AAPL" />);
    expect(getByText("AAPL")).toBeTruthy();
  });

  it("omits the ticker element when ticker is null", () => {
    const { container } = render(<Badge isin="DE0007164600" ticker={null} />);
    expect(container.querySelector(".ape-intel-badge__ticker")).toBeNull();
  });

  it("renders as a button", () => {
    const { container } = render(<Badge isin="US0378331005" />);
    expect(container.querySelector("button.ape-intel-badge")).toBeTruthy();
  });

  it("invokes onClick when clicked", () => {
    const onClick = vi.fn();
    const { container } = render(
      <Badge isin="US0378331005" onClick={onClick} />,
    );
    const button = container.querySelector("button.ape-intel-badge")!;
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders the barometer label, buzz, and trend when aggregate is provided", () => {
    const aggregate = {
      barometer: { score: 0.64, label: "very-bullish" as const, contributingSources: 1, totalConfidence: 1, lowConfidence: true },
      buzz: { level: "loud" as const, mentions: 247 },
      trend: "up" as const,
    };
    const { getByText } = render(<Badge isin="US0378331005" ticker="AAPL" aggregate={aggregate} />);
    expect(getByText("Very Bullish")).toBeTruthy();
    expect(getByText("Loud")).toBeTruthy();
    expect(getByText("↑")).toBeTruthy();
  });

  it("omits the barometer row when aggregate is undefined", () => {
    const { container } = render(<Badge isin="US0378331005" ticker="AAPL" />);
    expect(container.querySelector(".ape-intel-badge__barometer")).toBeNull();
  });

  it("omits the barometer row when aggregate is null", () => {
    const { container } = render(<Badge isin="US0378331005" ticker="AAPL" aggregate={null} />);
    expect(container.querySelector(".ape-intel-badge__barometer")).toBeNull();
  });
});
