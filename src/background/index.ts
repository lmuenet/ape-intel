import { fetchApewisdomSnapshot } from "../lib/apewisdom";
import { fetchCompanyNews, fetchNextEarnings } from "../lib/finnhub";
import { browserStorageKvStore } from "../lib/kv-store";
import { fetchTickerFromOpenFigi } from "../lib/openfigi";
import { fetchStockTwitsForTicker } from "../lib/stocktwits";
import { fetchTradestieSnapshot } from "../lib/tradestie";
import { createApewisdomService } from "./apewisdom-service";
import { createFinnhubService } from "./finnhub-service";
import { createStockTwitsService } from "./stocktwits-service";
import { createTradestieService } from "./tradestie-service";
import { handleMessage } from "./messages";

const store = browserStorageKvStore(browser.storage.local);
const apewisdom = createApewisdomService(store, () => fetchApewisdomSnapshot(fetch));
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
  }),
);
