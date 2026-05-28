import { render } from "preact";
import { Badge } from "./Badge";
import { SidePanel } from "./SidePanel";
import { observeIsin } from "../lib/url-observer";
import { browserStorageKvStore } from "../lib/kv-store";
import { createTickerCache } from "../lib/ticker-cache";
import type { ApewisdomEntry } from "../lib/apewisdom";
import type {
  ApewisdomLookupMessage,
  TickerLookupMessage,
} from "../background/messages";

const HOST_ID = "ape-intel-host";

async function lookupTickerViaBackground(isin: string): Promise<string | null> {
  const message: TickerLookupMessage = { type: "ticker:lookup", isin };
  return (await browser.runtime.sendMessage(message)) as string | null;
}

async function lookupApewisdomViaBackground(
  ticker: string,
): Promise<ApewisdomEntry | null> {
  const message: ApewisdomLookupMessage = { type: "apewisdom:lookup", ticker };
  return (await browser.runtime.sendMessage(message)) as ApewisdomEntry | null;
}

const tickerCache = createTickerCache(
  browserStorageKvStore(browser.storage.local),
  lookupTickerViaBackground,
);

function ensureHost(): HTMLElement {
  const existing = document.getElementById(HOST_ID);
  if (existing) return existing;
  const host = document.createElement("div");
  host.id = HOST_ID;
  document.body.appendChild(host);
  return host;
}

function unmount(): void {
  const host = document.getElementById(HOST_ID);
  if (host) render(null, host);
}

let isPanelOpen = false;
let currentIsin: string | null = null;
let currentTicker: string | null | undefined = undefined;
let currentApewisdom: ApewisdomEntry | null | undefined = undefined;

function paint(): void {
  if (currentIsin === null) {
    unmount();
    return;
  }
  render(
    <>
      <Badge
        isin={currentIsin}
        ticker={currentTicker}
        onClick={() => {
          isPanelOpen = !isPanelOpen;
          paint();
        }}
      />
      <SidePanel
        isOpen={isPanelOpen}
        ticker={currentTicker}
        apewisdom={currentApewisdom}
        onClose={() => {
          isPanelOpen = false;
          paint();
        }}
      />
    </>,
    ensureHost(),
  );
}

let generation = 0;

observeIsin(window, (isin) => {
  generation += 1;
  const requestGeneration = generation;

  currentIsin = isin;
  currentTicker = undefined;
  currentApewisdom = undefined;

  if (!isin) {
    paint();
    return;
  }

  paint();

  tickerCache.get(isin).then(
    (ticker) => {
      if (requestGeneration !== generation) return;
      currentTicker = ticker;
      paint();

      if (!ticker) return;
      lookupApewisdomViaBackground(ticker).then(
        (entry) => {
          if (requestGeneration !== generation) return;
          currentApewisdom = entry;
          paint();
        },
        (error) => {
          if (requestGeneration !== generation) return;
          console.warn("[ape-intel] apewisdom lookup failed", error);
          currentApewisdom = null;
          paint();
        },
      );
    },
    (error) => {
      if (requestGeneration !== generation) return;
      console.warn("[ape-intel] ticker lookup failed", error);
      currentTicker = null;
      paint();
    },
  );
});
