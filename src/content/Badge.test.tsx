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
});
