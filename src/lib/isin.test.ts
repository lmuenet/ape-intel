import { describe, expect, it } from "vitest";
import { isValidIsin, parseIsinFromUrl } from "./isin";

describe("isValidIsin", () => {
  it("accepts a well-formed ISIN", () => {
    expect(isValidIsin("US0378331005")).toBe(true);
    expect(isValidIsin("DE0007164600")).toBe(true);
  });

  it("rejects wrong length", () => {
    expect(isValidIsin("US037833100")).toBe(false);
    expect(isValidIsin("US03783310055")).toBe(false);
  });

  it("rejects bad country code (must be 2 letters)", () => {
    expect(isValidIsin("1S0378331005")).toBe(false);
    expect(isValidIsin("u50378331005")).toBe(false);
  });

  it("rejects non-digit check digit", () => {
    expect(isValidIsin("US037833100X")).toBe(false);
  });

  it("rejects empty / nullish", () => {
    expect(isValidIsin("")).toBe(false);
    expect(isValidIsin(null)).toBe(false);
  });
});

describe("parseIsinFromUrl", () => {
  it("extracts isin from Scalable security URL", () => {
    const url =
      "https://de.scalable.capital/broker/security?isin=US0378331005&portfolioId=abc";
    expect(parseIsinFromUrl(url)).toBe("US0378331005");
  });

  it("returns null when isin query param is missing", () => {
    expect(
      parseIsinFromUrl("https://de.scalable.capital/broker/security?foo=bar"),
    ).toBeNull();
  });

  it("returns null when isin query param is malformed", () => {
    expect(
      parseIsinFromUrl(
        "https://de.scalable.capital/broker/security?isin=not-an-isin",
      ),
    ).toBeNull();
  });

  it("returns null for non-Scalable URLs", () => {
    expect(
      parseIsinFromUrl("https://example.com/broker/security?isin=US0378331005"),
    ).toBeNull();
  });

  it("returns null on unparseable URL", () => {
    expect(parseIsinFromUrl("not a url")).toBeNull();
  });
});
