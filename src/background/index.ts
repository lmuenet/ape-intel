import { fetchApewisdomSnapshot } from "../lib/apewisdom";
import { fetchCompanyNews, fetchNextEarnings } from "../lib/finnhub";
import { browserStorageKvStore } from "../lib/kv-store";
import { fetchTickerFromOpenFigi } from "../lib/openfigi";
import { fetchStockTwitsForTicker } from "../lib/stocktwits";
import { fetchTradestieSnapshot } from "../lib/tradestie";
import { createApewisdomService } from "./apewisdom-service";
import { buildFavouritesBoard } from "./favourites-board";
import { createFavouritesService } from "./favourites-service";
import { createSnapshotService } from "./snapshot-service";
import { createFinnhubService } from "./finnhub-service";
import { createStockTwitsService } from "./stocktwits-service";
import { createTradestieService } from "./tradestie-service";
import { createLogService } from "./log-service";
import { handleMessage } from "./messages";
import { createLogger, resolveLevel, LOG_LEVEL_KEY, type LogLevel } from "../lib/logger";

const store = browserStorageKvStore(browser.storage.local);

const logService = createLogService(store);
// Active level is cached and refreshed on change so each emit is synchronous.
let activeLevel: LogLevel = resolveLevel(undefined, import.meta.env.DEV);
void store.get<LogLevel>(LOG_LEVEL_KEY).then((lvl) => { activeLevel = resolveLevel(lvl, import.meta.env.DEV); });
browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[LOG_LEVEL_KEY]) {
    activeLevel = resolveLevel(changes[LOG_LEVEL_KEY].newValue as LogLevel | undefined, import.meta.env.DEV);
  }
});
const log = createLogger({
  context: "background",
  getLevel: () => activeLevel,
  ship: (entry) => { void logService.append(entry); },
});
const apewisdom = createApewisdomService(store, () => fetchApewisdomSnapshot(fetch));
const favourites = createFavouritesService(store);
const snapshot = createSnapshotService(
  store,
  () => favourites.get(),
  () => fetchApewisdomSnapshot(fetch),
);
const tradestie = createTradestieService(store, () => fetchTradestieSnapshot(fetch));
const stocktwits = createStockTwitsService(store, (ticker) => fetchStockTwitsForTicker(ticker, fetch));
const finnhub = createFinnhubService(
  store,
  (ticker, key) => fetchCompanyNews(ticker, key, fetch),
  (ticker, key) => fetchNextEarnings(ticker, key, fetch),
);

browser.runtime.onMessage.addListener((message) =>
  handleMessage(message, {
    fetchTicker: (isin) => fetchTickerFromOpenFigi(isin, fetch),
    lookupApewisdom: (ticker, force) => apewisdom.lookup(ticker, force),
    lookupTradestie: (ticker) => tradestie.lookup(ticker),
    lookupStockTwits: (ticker, force) => stocktwits.lookup(ticker, force),
    lookupFinnhubNews: (ticker, force) => finnhub.news(ticker, force),
    lookupFinnhubEarnings: (ticker, force) => finnhub.earnings(ticker, force),
    toggleFavourite: (fav) => favourites.toggle(fav),
    isFavourite: (isin) => favourites.has(isin),
    getSnapshotHistory: (isin) => snapshot.history(isin),
    getTrendingBoard: () => apewisdom.board(),
    getFavouritesBoard: () =>
      buildFavouritesBoard({
        getFavourites: () => favourites.get(),
        lookupApewisdom: (ticker) => apewisdom.lookup(ticker),
        getHistory: (isin) => snapshot.history(isin),
      }),
    appendLog: (entry) => logService.append(entry),
  }),
);

const runSnapshot = (): void => {
  snapshot.runIfDue(Date.now()).catch((e) => log.error("daily snapshot job failed", e));
};

const DAILY_SNAPSHOT_ALARM = "daily-snapshot";
// Poll hourly; the UTC-day guard inside runIfDue makes this at-most-once-per-day.
browser.alarms.create(DAILY_SNAPSHOT_ALARM, { periodInMinutes: 60 });
browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === DAILY_SNAPSHOT_ALARM) runSnapshot();
});
// Catch up a missed day as soon as the browser comes back.
browser.runtime.onStartup.addListener(runSnapshot);
browser.runtime.onInstalled.addListener(runSnapshot);
