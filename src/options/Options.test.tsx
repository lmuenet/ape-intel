import { render, cleanup, waitFor, fireEvent } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Options } from "./Options";
import { createInMemoryKvStore } from "../lib/kv-store";

afterEach(cleanup);

describe("<Options />", () => {
  it("loads stored values into the sections and reads logs", async () => {
    const store = createInMemoryKvStore({ "finnhub:apiKey": "K1", "log:level": "error" });
    const send = vi.fn().mockResolvedValue([]);
    const { getByLabelText } = render(<Options store={store} send={send} />);
    await waitFor(() => expect((getByLabelText("Finnhub API key") as HTMLInputElement).value).toBe("K1"));
    expect((getByLabelText("Log level") as HTMLSelectElement).value).toBe("error");
    expect(send).toHaveBeenCalledWith({ type: "log:read" });
  });

  it("seeds the prompt with the default when no override is stored", async () => {
    const store = createInMemoryKvStore({});
    const send = vi.fn().mockResolvedValue([]);
    const { getByLabelText } = render(<Options store={store} send={send} />);
    await waitFor(() =>
      expect((getByLabelText("Export prompt") as HTMLTextAreaElement).value.length).toBeGreaterThan(50),
    );
  });

  it("treats saving a blank prompt as a reset (removes the override)", async () => {
    const store = createInMemoryKvStore({ "export:prompt": "MY CUSTOM PROMPT" });
    const send = vi.fn().mockResolvedValue([]);
    const { getByLabelText, getAllByText } = render(<Options store={store} send={send} />);
    await waitFor(() =>
      expect((getByLabelText("Export prompt") as HTMLTextAreaElement).value).toBe("MY CUSTOM PROMPT"),
    );
    fireEvent.input(getByLabelText("Export prompt"), { target: { value: "   " } });
    // Two "Save" buttons exist (key + prompt); the prompt section renders last.
    const saves = getAllByText("Save");
    fireEvent.click(saves[saves.length - 1]);
    await waitFor(async () => expect(await store.get("export:prompt")).toBeUndefined());
  });
});
