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

  it("renders a main button", () => {
    const { container } = render(<Badge isin="US0378331005" />);
    expect(container.querySelector("button.ape-intel-badge__main")).toBeTruthy();
  });

  it("invokes onClick when the main button is clicked", () => {
    const onClick = vi.fn();
    const { container } = render(
      <Badge isin="US0378331005" onClick={onClick} />,
    );
    const button = container.querySelector("button.ape-intel-badge__main")!;
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("invokes onOpenDashboard from the dashboard icon, not onClick", () => {
    const onClick = vi.fn();
    const onOpenDashboard = vi.fn();
    const { getByRole } = render(
      <Badge isin="US0378331005" onClick={onClick} onOpenDashboard={onOpenDashboard} />,
    );
    fireEvent.click(getByRole("button", { name: /trending dashboard/i }));
    expect(onOpenDashboard).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
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

  it("renders a coverage dot with the state and an aria-label", () => {
    const { container } = render(<Badge isin="US0378331005" ticker="AAPL" coverage="covered" />);
    const dot = container.querySelector(".ape-intel-badge__coverage");
    expect(dot).toBeTruthy();
    expect(dot!.getAttribute("data-coverage")).toBe("covered");
    expect(dot!.getAttribute("aria-label")).toBe("Coverage: Covered");
  });

  it("omits the coverage dot when coverage is unknown", () => {
    const { container } = render(<Badge isin="US0378331005" ticker="AAPL" coverage="unknown" />);
    expect(container.querySelector(".ape-intel-badge__coverage")).toBeNull();
  });

  it("omits the coverage dot when coverage is not provided", () => {
    const { container } = render(<Badge isin="US0378331005" ticker="AAPL" />);
    expect(container.querySelector(".ape-intel-badge__coverage")).toBeNull();
  });
});
