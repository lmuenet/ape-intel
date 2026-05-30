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
import { handleMessage } from "./messages";

const store = browserStorageKvStore(browser.storage.local);
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
    lookupApewisdom: (ticker) => apewisdom.lookup(ticker),
    lookupTradestie: (ticker) => tradestie.lookup(ticker),
    lookupStockTwits: (ticker) => stocktwits.lookup(ticker),
    lookupFinnhubNews: (ticker) => finnhub.news(ticker),
    lookupFinnhubEarnings: (ticker) => finnhub.earnings(ticker),
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
  }),
);

const DAILY_SNAPSHOT_ALARM = "daily-snapshot";
// Poll hourly; the UTC-day guard inside runIfDue makes this at-most-once-per-day.
browser.alarms.create(DAILY_SNAPSHOT_ALARM, { periodInMinutes: 60 });
browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === DAILY_SNAPSHOT_ALARM) void snapshot.runIfDue(Date.now());
});
// Catch up a missed day as soon as the browser comes back.
browser.runtime.onStartup.addListener(() => void snapshot.runIfDue(Date.now()));
browser.runtime.onInstalled.addListener(() => void snapshot.runIfDue(Date.now()));
