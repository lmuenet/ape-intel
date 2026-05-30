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
import type { EarningsDate, NewsItem } from "../lib/finnhub";
import type { DailySnapshot } from "../lib/snapshot-history";
import type {
  ApewisdomLookupMessage,
  FavouriteHasMessage,
  FavouriteToggleMessage,
  FinnhubEarningsLookupMessage,
  FinnhubNewsLookupMessage,
  SnapshotHistoryMessage,
  StockTwitsLookupMessage,
  TickerLookupMessage,
} from "../background/messages";

const HOST_ID = "ape-intel-host";
const FINNHUB_KEY = "finnhub:apiKey";

async function send<T>(message: unknown): Promise<T> {
  return (await browser.runtime.sendMessage(message)) as T;
}

const store = browserStorageKvStore(browser.storage.local);
const tickerCache = createTickerCache(
  store,
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
let currentNews: NewsItem[] | null | undefined = undefined;
let currentEarnings: EarningsDate | null | undefined = undefined;
let finnhubKey: string | null | undefined = undefined;
let isFavourite = false;
let showCapHint = false;
let currentHistory: DailySnapshot[] | null | undefined = undefined;

// undefined while either sentiment/volume source is still loading; otherwise a
// computed Aggregate (uncovered assets yield an "unavailable" barometer, not null).
function currentAggregate(): Aggregate | undefined {
  if (currentStockTwits === undefined || currentApewisdom === undefined) return undefined;
  return computeAggregate({ stocktwits: currentStockTwits, apewisdom: currentApewisdom });
}

let generation = 0;

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
        news={currentNews}
        earnings={currentEarnings}
        finnhubKey={finnhubKey}
        onSaveKey={onSaveKey}
        isFavourite={isFavourite}
        showCapHint={showCapHint}
        onToggleFavourite={onToggleFavourite}
        history={currentHistory}
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

function dispatchFinnhubLookups(ticker: string, gen: number): void {
  currentNews = undefined;
  currentEarnings = undefined;
  paint();
  send<NewsItem[] | null>({ type: "finnhub:news", ticker } satisfies FinnhubNewsLookupMessage).then(
    (items) => { if (gen === generation) { currentNews = items; paint(); } },
    (e) => { if (gen === generation) { console.warn("[ape-intel] finnhub news lookup failed", e); currentNews = null; paint(); } },
  );
  send<EarningsDate | null>({ type: "finnhub:earnings", ticker } satisfies FinnhubEarningsLookupMessage).then(
    (date) => { if (gen === generation) { currentEarnings = date; paint(); } },
    (e) => { if (gen === generation) { console.warn("[ape-intel] finnhub earnings lookup failed", e); currentEarnings = null; paint(); } },
  );
}

function dispatchHistoryLookup(isin: string, gen: number): void {
  currentHistory = undefined;
  paint();
  send<DailySnapshot[]>({ type: "snapshot:history", isin } satisfies SnapshotHistoryMessage).then(
    (history) => { if (gen === generation) { currentHistory = history; paint(); } },
    (e) => { if (gen === generation) { console.warn("[ape-intel] snapshot history lookup failed", e); currentHistory = null; paint(); } },
  );
}

function onSaveKey(key: string): void {
  const gen = generation;
  store.set(FINNHUB_KEY, key).then(() => {
    if (gen !== generation) return;
    finnhubKey = key;
    if (typeof currentTicker === "string") dispatchFinnhubLookups(currentTicker, gen);
    else paint();
  });
}

function onToggleFavourite(): void {
  if (currentIsin === null || typeof currentTicker !== "string") return;
  const gen = generation;
  const isin = currentIsin;
  const wasFavourite = isFavourite;
  showCapHint = false;
  send<boolean>({ type: "favourites:toggle", isin, ticker: currentTicker } satisfies FavouriteToggleMessage).then(
    (nowFavourite) => {
      if (gen !== generation) return;
      isFavourite = nowFavourite;
      if (nowFavourite) dispatchHistoryLookup(isin, gen);
      else currentHistory = undefined;
      // Adding was rejected by the cap when the state did not flip to true.
      if (!wasFavourite && !nowFavourite) showCapHint = true;
      paint();
    },
    (e) => { if (gen === generation) console.warn("[ape-intel] favourites toggle failed", e); },
  );
}

observeIsin(window, (isin) => {
  generation += 1;
  const gen = generation;

  currentIsin = isin;
  currentTicker = undefined;
  currentApewisdom = undefined;
  currentStockTwits = undefined;
  currentNews = undefined;
  currentEarnings = undefined;
  finnhubKey = undefined;
  isFavourite = false;
  showCapHint = false;
  currentHistory = undefined;
  isChartOpen = false; // close chart on navigation

  if (!isin) { paint(); return; }
  paint();

  tickerCache.get(isin).then(
    (ticker) => {
      if (gen !== generation) return;
      currentTicker = ticker;
      paint();

      if (ticker) {
        dispatchSentimentLookups(ticker, gen);
        send<boolean>({ type: "favourites:has", isin } satisfies FavouriteHasMessage).then(
          (fav) => { if (gen === generation) { isFavourite = fav; paint(); if (fav) dispatchHistoryLookup(isin, gen); } },
          (e) => { if (gen === generation) console.warn("[ape-intel] favourites has failed", e); },
        );
        store.get<string>(FINNHUB_KEY).then((key) => {
          if (gen !== generation) return;
          finnhubKey = key ?? null;
          paint();
          if (key) dispatchFinnhubLookups(ticker, gen);
        });
      } else {
        currentApewisdom = null;
        currentStockTwits = null;
        currentNews = null;
        currentEarnings = null;
        finnhubKey = null;
        paint();
      }
    },
    (e) => {
      if (gen !== generation) return;
      console.warn("[ape-intel] ticker lookup failed", e);
      currentTicker = null;
      currentApewisdom = null;
      currentStockTwits = null;
      currentNews = null;
      currentEarnings = null;
      finnhubKey = null;
      paint();
    },
  );
});
