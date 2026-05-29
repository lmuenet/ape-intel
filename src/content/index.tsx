import { render } from "preact";
import { Badge } from "./Badge";
import { ChartOverlay } from "./ChartOverlay";
import { SidePanel } from "./SidePanel";
import { observeIsin } from "../lib/url-observer";
import { browserStorageKvStore } from "../lib/kv-store";
import { createTickerCache } from "../lib/ticker-cache";
import type { ApewisdomEntry } from "../lib/apewisdom";
import type { StockTwitsEntry } from "../lib/stocktwits";
import { aggregate as computeAggregate } from "../lib/barometer";
import type { Aggregate } from "../lib/barometer";
import type {
  ApewisdomLookupMessage,
  StockTwitsLookupMessage,
  TickerLookupMessage,
} from "../background/messages";

const HOST_ID = "ape-intel-host";

async function send<T>(message: unknown): Promise<T> {
  return (await browser.runtime.sendMessage(message)) as T;
}

const tickerCache = createTickerCache(
  browserStorageKvStore(browser.storage.local),
  (isin) => send<string | null>({ type: "ticker:lookup", isin } satisfies TickerLookupMessage),
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
let isChartOpen = false;
let currentIsin: string | null = null;
let currentTicker: string | null | undefined = undefined;
let currentApewisdom: ApewisdomEntry | null | undefined = undefined;
let currentStockTwits: StockTwitsEntry | null | undefined = undefined;

// undefined while either sentiment/volume source is still loading; otherwise a
// computed Aggregate (uncovered assets yield an "unavailable" barometer, not null).
function currentAggregate(): Aggregate | undefined {
  if (currentStockTwits === undefined || currentApewisdom === undefined) return undefined;
  return computeAggregate({ stocktwits: currentStockTwits, apewisdom: currentApewisdom });
}

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
        aggregate={currentAggregate()}
        onClick={() => { isPanelOpen = !isPanelOpen; paint(); }}
      />
      <SidePanel
        isOpen={isPanelOpen}
        ticker={currentTicker}
        aggregate={currentAggregate()}
        apewisdom={currentApewisdom}
        stocktwits={currentStockTwits}
        onClose={() => { isPanelOpen = false; paint(); }}
        onTradingViewClick={() => { isChartOpen = true; paint(); }}
      />
      <ChartOverlay
        isOpen={isChartOpen}
        ticker={currentTicker}
        onClose={() => { isChartOpen = false; paint(); }}
      />
    </>,
    ensureHost(),
  );
}

let generation = 0;

function dispatchSentimentLookups(ticker: string, gen: number): void {
  send<ApewisdomEntry | null>({ type: "apewisdom:lookup", ticker } satisfies ApewisdomLookupMessage).then(
    (entry) => { if (gen === generation) { currentApewisdom = entry; paint(); } },
    (e) => { if (gen === generation) { console.warn("[ape-intel] apewisdom lookup failed", e); currentApewisdom = null; paint(); } },
  );
  send<StockTwitsEntry | null>({ type: "stocktwits:lookup", ticker } satisfies StockTwitsLookupMessage).then(
    (entry) => { if (gen === generation) { currentStockTwits = entry; paint(); } },
    (e) => { if (gen === generation) { console.warn("[ape-intel] stocktwits lookup failed", e); currentStockTwits = null; paint(); } },
  );
}

observeIsin(window, (isin) => {
  generation += 1;
  const gen = generation;

  currentIsin = isin;
  currentTicker = undefined;
  currentApewisdom = undefined;
  currentStockTwits = undefined;
  isChartOpen = false; // close chart on navigation

  if (!isin) { paint(); return; }
  paint();

  tickerCache.get(isin).then(
    (ticker) => {
      if (gen !== generation) return;
      currentTicker = ticker;
      paint();
      if (ticker) dispatchSentimentLookups(ticker, gen);
      else {
        currentApewisdom = null;
        currentStockTwits = null;
        paint();
      }
    },
    (e) => {
      if (gen !== generation) return;
      console.warn("[ape-intel] ticker lookup failed", e);
      currentTicker = null;
      currentApewisdom = null;
      currentStockTwits = null;
      paint();
    },
  );
});
