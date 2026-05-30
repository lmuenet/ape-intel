import { render, cleanup, fireEvent } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChallengePanel } from "./ChallengePanel";
import type { StoredTrendingChallenge } from "../lib/trending-challenge";

afterEach(cleanup);

const challenge = (over: Partial<StoredTrendingChallenge> = {}): StoredTrendingChallenge => ({
  summary: "One real play.",
  verdicts: [{ ticker: "TSLA", verdict: "signal" }],
  ingestedAt: "2026-05-31T08:00:00.000Z",
  tickers: ["TSLA"],
  ...over,
});

const noop = () => {};

describe("<ChallengePanel />", () => {
  it("calls onCopy when the copy button is clicked", () => {
    const onCopy = vi.fn();
    const { getByRole } = render(
      <ChallengePanel copyState="idle" onCopy={onCopy} challenge={null} stale={false} parseError={false} onApply={noop} onClear={noop} />,
    );
    fireEvent.click(getByRole("button", { name: /copy/i }));
    expect(onCopy).toHaveBeenCalledTimes(1);
  });

  it("calls onApply with the pasted text", () => {
    const onApply = vi.fn();
    const { getByRole, getByLabelText } = render(
      <ChallengePanel copyState="idle" onCopy={noop} challenge={null} stale={false} parseError={false} onApply={onApply} onClear={noop} />,
    );
    fireEvent.input(getByLabelText(/paste/i), { target: { value: '[{"ticker":"X","verdict":"signal"}]' } });
    fireEvent.click(getByRole("button", { name: /apply/i }));
    expect(onApply).toHaveBeenCalledWith('[{"ticker":"X","verdict":"signal"}]');
  });

  it("shows the summary and an 'as of' line when a challenge is loaded", () => {
    const { getByText } = render(
      <ChallengePanel copyState="idle" onCopy={noop} challenge={challenge()} stale={false} parseError={false} onApply={noop} onClear={noop} />,
    );
    expect(getByText("One real play.")).toBeTruthy();
    expect(getByText(/as of/i)).toBeTruthy();
  });

  it("shows a staleness hint when stale", () => {
    const { getByText } = render(
      <ChallengePanel copyState="idle" onCopy={noop} challenge={challenge()} stale={true} parseError={false} onApply={noop} onClear={noop} />,
    );
    expect(getByText(/board updated/i)).toBeTruthy();
  });

  it("shows a parse-error hint", () => {
    const { getByText } = render(
      <ChallengePanel copyState="idle" onCopy={noop} challenge={null} stale={false} parseError={true} onApply={noop} onClear={noop} />,
    );
    expect(getByText(/couldn.t read/i)).toBeTruthy();
  });
});
