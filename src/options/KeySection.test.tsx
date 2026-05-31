import { render, cleanup, fireEvent } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KeySection } from "./KeySection";

afterEach(cleanup);

describe("<KeySection />", () => {
  it("prefills the input with the current value", () => {
    const { getByLabelText } = render(<KeySection value="KEY123" onSave={() => {}} onDelete={() => {}} />);
    expect((getByLabelText("Finnhub API key") as HTMLInputElement).value).toBe("KEY123");
  });
  it("shows a 'set' status when a value exists", () => {
    const { getByText } = render(<KeySection value="KEY" onSave={() => {}} onDelete={() => {}} />);
    expect(getByText("Key is set.")).toBeTruthy();
  });
  it("calls onSave with the trimmed value", () => {
    const onSave = vi.fn();
    const { getByLabelText, getByText } = render(<KeySection value="" onSave={onSave} onDelete={() => {}} />);
    fireEvent.input(getByLabelText("Finnhub API key"), { target: { value: "  ABC  " } });
    fireEvent.click(getByText("Save"));
    expect(onSave).toHaveBeenCalledWith("ABC");
  });
  it("does not call onSave for a blank field", () => {
    const onSave = vi.fn();
    const { getByText } = render(<KeySection value="" onSave={onSave} onDelete={() => {}} />);
    fireEvent.click(getByText("Save"));
    expect(onSave).not.toHaveBeenCalled();
  });
  it("calls onDelete", () => {
    const onDelete = vi.fn();
    const { getByText } = render(<KeySection value="K" onSave={() => {}} onDelete={onDelete} />);
    fireEvent.click(getByText("Delete"));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
