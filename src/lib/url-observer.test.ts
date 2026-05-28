import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { observeIsin } from "./url-observer";

const SEC = (isin: string) =>
  `https://de.scalable.capital/broker/security?isin=${isin}`;
const NON_SEC = "https://de.scalable.capital/broker/portfolio";
const INTERVAL = 50;

describe("observeIsin (polling)", () => {
  let cleanup: () => void = () => {};

  beforeEach(() => {
    vi.useFakeTimers();
    window.history.replaceState({}, "", SEC("US0378331005"));
  });

  afterEach(() => {
    cleanup();
    cleanup = () => {};
    vi.useRealTimers();
    window.history.replaceState({}, "", "/");
  });

  it("emits the initial ISIN synchronously on subscribe", () => {
    const listener = vi.fn();
    cleanup = observeIsin(window, listener, INTERVAL);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith("US0378331005");
  });

  it("emits a new ISIN after the URL changes and the next poll fires", () => {
    const listener = vi.fn();
    cleanup = observeIsin(window, listener, INTERVAL);
    listener.mockClear();

    window.history.replaceState({}, "", SEC("DE0007164600"));
    expect(listener).not.toHaveBeenCalled();

    vi.advanceTimersByTime(INTERVAL);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith("DE0007164600");
  });

  it("emits null when the next poll sees a non-security URL", () => {
    const listener = vi.fn();
    cleanup = observeIsin(window, listener, INTERVAL);
    listener.mockClear();

    window.history.replaceState({}, "", NON_SEC);
    vi.advanceTimersByTime(INTERVAL);

    expect(listener).toHaveBeenCalledWith(null);
  });

  it("does not re-emit when the URL did not change", () => {
    const listener = vi.fn();
    cleanup = observeIsin(window, listener, INTERVAL);
    listener.mockClear();

    vi.advanceTimersByTime(INTERVAL * 5);

    expect(listener).not.toHaveBeenCalled();
  });

  it("responds to popstate immediately without waiting for the next poll", () => {
    const listener = vi.fn();
    cleanup = observeIsin(window, listener, INTERVAL);
    listener.mockClear();

    window.history.replaceState({}, "", SEC("DE0007164600"));
    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(listener).toHaveBeenCalledWith("DE0007164600");
  });

  it("stops polling and listening on cleanup", () => {
    const listener = vi.fn();
    cleanup = observeIsin(window, listener, INTERVAL);
    listener.mockClear();

    cleanup();
    cleanup = () => {};

    window.history.replaceState({}, "", SEC("DE0007164600"));
    vi.advanceTimersByTime(INTERVAL * 5);
    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(listener).not.toHaveBeenCalled();
  });
});
