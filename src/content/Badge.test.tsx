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
});
