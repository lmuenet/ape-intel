import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { observeIsin } from "./url-observer";

const SEC = (isin: string) =>
  `https://de.scalable.capital/broker/security?isin=${isin}`;
const NON_SEC = "https://de.scalable.capital/broker/portfolio";

describe("observeIsin", () => {
  let cleanup: () => void = () => {};

  beforeEach(() => {
    window.history.replaceState({}, "", SEC("US0378331005"));
  });

  afterEach(() => {
    cleanup();
    window.history.replaceState({}, "", "/");
  });

  it("emits the initial ISIN synchronously on subscribe", () => {
    const listener = vi.fn();
    cleanup = observeIsin(window, listener);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith("US0378331005");
  });

  it("emits new ISIN when pushState changes the url", () => {
    const listener = vi.fn();
    cleanup = observeIsin(window, listener);
    listener.mockClear();

    window.history.pushState({}, "", SEC("DE0007164600"));

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith("DE0007164600");
  });

  it("emits null when replaceState moves off a security page", () => {
    const listener = vi.fn();
    cleanup = observeIsin(window, listener);
    listener.mockClear();

    window.history.replaceState({}, "", NON_SEC);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(null);
  });

  it("does not re-emit when the url did not change", () => {
    const listener = vi.fn();
    cleanup = observeIsin(window, listener);
    listener.mockClear();

    window.history.pushState({}, "", SEC("US0378331005"));

    expect(listener).not.toHaveBeenCalled();
  });

  it("restores history methods on cleanup and stops emitting", () => {
    const originalPush = window.history.pushState;
    const listener = vi.fn();
    cleanup = observeIsin(window, listener);
    listener.mockClear();

    cleanup();
    cleanup = () => {};

    expect(window.history.pushState).toBe(originalPush);

    window.history.pushState({}, "", SEC("DE0007164600"));
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(listener).not.toHaveBeenCalled();
  });
});
