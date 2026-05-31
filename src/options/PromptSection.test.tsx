import { render, cleanup, fireEvent } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PromptSection } from "./PromptSection";

afterEach(cleanup);

describe("<PromptSection />", () => {
  it("seeds the textarea with the value", () => {
    const { getByLabelText } = render(
      <PromptSection value="BASE PROMPT" isCustom={false} onSave={() => {}} onReset={() => {}} />,
    );
    expect((getByLabelText("Export prompt") as HTMLTextAreaElement).value).toBe("BASE PROMPT");
  });
  it("shows customised vs default status", () => {
    const { getByText, rerender } = render(
      <PromptSection value="x" isCustom={true} onSave={() => {}} onReset={() => {}} />,
    );
    expect(getByText("Customised.")).toBeTruthy();
    rerender(<PromptSection value="x" isCustom={false} onSave={() => {}} onReset={() => {}} />);
    expect(getByText("Using the default.")).toBeTruthy();
  });
  it("calls onSave with the edited text", () => {
    const onSave = vi.fn();
    const { getByLabelText, getByText } = render(
      <PromptSection value="x" isCustom={false} onSave={onSave} onReset={() => {}} />,
    );
    fireEvent.input(getByLabelText("Export prompt"), { target: { value: "edited" } });
    fireEvent.click(getByText("Save"));
    expect(onSave).toHaveBeenCalledWith("edited");
  });
  it("calls onReset", () => {
    const onReset = vi.fn();
    const { getByText } = render(
      <PromptSection value="x" isCustom={true} onSave={() => {}} onReset={onReset} />,
    );
    fireEvent.click(getByText("Reset to default"));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
