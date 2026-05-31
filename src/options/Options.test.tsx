import { render, cleanup, waitFor } from "@testing-library/preact";
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
});
