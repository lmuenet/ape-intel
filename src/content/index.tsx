import { render } from "preact";
import { Badge } from "./Badge";
import { observeIsin } from "../lib/url-observer";
import { browserStorageKvStore } from "../lib/kv-store";
import { createTickerCache } from "../lib/ticker-cache";
import { fetchTickerFromOpenFigi } from "../lib/openfigi";

const HOST_ID = "ape-intel-host";

const tickerCache = createTickerCache(
  browserStorageKvStore(browser.storage.local),
  (isin) => fetchTickerFromOpenFigi(isin, fetch),
);

function ensureHost(): HTMLElement {
  const existing = document.getElementById(HOST_ID);
  if (existing) return existing;
  const host = document.createElement("div");
  host.id = HOST_ID;
  document.body.appendChild(host);
  return host;
}

function renderBadge(isin: string, ticker: string | null | undefined): void {
  render(<Badge isin={isin} ticker={ticker} />, ensureHost());
}

function unmount(): void {
  const host = document.getElementById(HOST_ID);
  if (host) render(null, host);
}

let generation = 0;

observeIsin(window, (isin) => {
  generation += 1;
  const requestGeneration = generation;

  if (!isin) {
    unmount();
    return;
  }

  renderBadge(isin, undefined);

  tickerCache.get(isin).then(
    (ticker) => {
      if (requestGeneration !== generation) return;
      renderBadge(isin, ticker);
    },
    (error) => {
      if (requestGeneration !== generation) return;
      console.warn("[ape-intel] ticker lookup failed", error);
    },
  );
});
