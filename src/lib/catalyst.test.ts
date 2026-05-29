import { describe, expect, it } from "vitest";
import { classifyCatalyst, CATALYST_LABEL } from "./catalyst";

describe("classifyCatalyst", () => {
  it("tags earnings headlines", () => {
    expect(classifyCatalyst("Apple posts Q2 earnings beat")).toBe("earnings");
  });
  it("tags M&A headlines", () => {
    expect(classifyCatalyst("Broadcom to acquire VMware")).toBe("m&a");
  });
  it("tags guidance headlines", () => {
    expect(classifyCatalyst("Ford cuts full-year outlook")).toBe("guidance");
  });
  it("tags analyst headlines", () => {
    expect(classifyCatalyst("Goldman initiates Tesla with Buy rating")).toBe("analyst");
  });
  it("tags regulatory headlines", () => {
    expect(classifyCatalyst("FDA approval for Pfizer drug")).toBe("regulatory");
  });
  it("tags product headlines", () => {
    expect(classifyCatalyst("Apple unveils new iPhone")).toBe("product");
  });
  it("falls back to news", () => {
    expect(classifyCatalyst("CEO discusses company strategy at conference")).toBe("news");
  });
  it("checks earnings before guidance", () => {
    expect(classifyCatalyst("Acme earnings beat as it raises guidance")).toBe("earnings");
  });
  it("exposes a display label for every tag", () => {
    expect(CATALYST_LABEL["m&a"]).toBe("M&A");
    expect(CATALYST_LABEL.news).toBe("News");
  });
});
