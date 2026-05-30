import { render, cleanup, fireEvent } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardOverlay } from "./DashboardOverlay";

afterEach(cleanup);

const Board = () => <div>BOARD CONTENT</div>;

describe("<DashboardOverlay />", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<DashboardOverlay isOpen={false} onClose={() => {}} Board={Board} />);
    expect(container.textContent).toBe("");
  });

  it("renders the board when open", () => {
    const { getByText } = render(<DashboardOverlay isOpen onClose={() => {}} Board={Board} />);
    expect(getByText("BOARD CONTENT")).toBeTruthy();
  });

  it("calls onClose from the close button", () => {
    const onClose = vi.fn();
    const { getByRole } = render(<DashboardOverlay isOpen onClose={onClose} Board={Board} />);
    fireEvent.click(getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose on Escape", () => {
    const onClose = vi.fn();
    render(<DashboardOverlay isOpen onClose={onClose} Board={Board} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on a backdrop click but not on a click inside the panel", () => {
    const onClose = vi.fn();
    const { getByRole, getByText } = render(<DashboardOverlay isOpen onClose={onClose} Board={Board} />);
    fireEvent.click(getByText("BOARD CONTENT"));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
