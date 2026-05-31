import { render, cleanup, fireEvent } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LogsSection } from "./LogsSection";
import type { LogEntry } from "../lib/logger";

afterEach(cleanup);

const e = (o: Partial<LogEntry>): LogEntry => ({ ts: 1, level: "info", context: "background", message: "m", ...o });

describe("<LogsSection />", () => {
  it("renders entries newest-first", () => {
    const { container } = render(
      <LogsSection level="warn" onLevelChange={() => {}} entries={[e({ message: "first" }), e({ message: "second" })]} onRefresh={() => {}} onClear={() => {}} />,
    );
    const text = container.querySelector(".ape-options__logs")!.textContent!;
    expect(text.indexOf("second")).toBeLessThan(text.indexOf("first"));
  });
  it("filters by level", () => {
    const { container, getByLabelText } = render(
      <LogsSection level="warn" onLevelChange={() => {}} entries={[e({ level: "debug", message: "dbg" }), e({ level: "error", message: "err" })]} onRefresh={() => {}} onClear={() => {}} />,
    );
    fireEvent.change(getByLabelText("Log filter"), { target: { value: "error" } });
    const text = container.querySelector(".ape-options__logs")!.textContent!;
    expect(text).toContain("err");
    expect(text).not.toContain("dbg");
  });
  it("calls onLevelChange when the level select changes", () => {
    const onLevelChange = vi.fn();
    const { getByLabelText } = render(
      <LogsSection level="warn" onLevelChange={onLevelChange} entries={[]} onRefresh={() => {}} onClear={() => {}} />,
    );
    fireEvent.change(getByLabelText("Log level"), { target: { value: "debug" } });
    expect(onLevelChange).toHaveBeenCalledWith("debug");
  });
  it("calls onRefresh and onClear", () => {
    const onRefresh = vi.fn();
    const onClear = vi.fn();
    const { getByText } = render(
      <LogsSection level="warn" onLevelChange={() => {}} entries={[]} onRefresh={onRefresh} onClear={onClear} />,
    );
    fireEvent.click(getByText("Refresh"));
    fireEvent.click(getByText("Clear"));
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onClear).toHaveBeenCalledTimes(1);
  });
  it("copies filtered logs via the injected clipboard writer", () => {
    const writeClipboard = vi.fn().mockResolvedValue(undefined);
    const { getByText } = render(
      <LogsSection level="warn" onLevelChange={() => {}} entries={[e({ message: "xyz" })]} onRefresh={() => {}} onClear={() => {}} writeClipboard={writeClipboard} />,
    );
    fireEvent.click(getByText("Copy all"));
    expect(writeClipboard).toHaveBeenCalledTimes(1);
    expect(writeClipboard.mock.calls[0][0]).toContain("xyz");
  });
  it("shows loading, error and empty states", () => {
    const { rerender, getByText } = render(
      <LogsSection level="warn" onLevelChange={() => {}} entries={undefined} onRefresh={() => {}} onClear={() => {}} />,
    );
    expect(getByText("Loading…")).toBeTruthy();
    rerender(<LogsSection level="warn" onLevelChange={() => {}} entries={null} onRefresh={() => {}} onClear={() => {}} />);
    expect(getByText("Couldn't load logs.")).toBeTruthy();
    rerender(<LogsSection level="warn" onLevelChange={() => {}} entries={[]} onRefresh={() => {}} onClear={() => {}} />);
    expect(getByText("No log entries.")).toBeTruthy();
  });
});
