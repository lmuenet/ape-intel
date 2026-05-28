import { render, cleanup } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { Badge } from "./Badge";

afterEach(cleanup);

describe("<Badge />", () => {
  it("renders the ISIN it was given", () => {
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

  it("omits the ticker element when ticker is undefined", () => {
    const { container } = render(<Badge isin="US0378331005" />);
    expect(container.querySelector(".ape-intel-badge__ticker")).toBeNull();
  });
});
