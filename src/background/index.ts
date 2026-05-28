import { fetchApewisdomSnapshot } from "../lib/apewisdom";
import { browserStorageKvStore } from "../lib/kv-store";
import { fetchTickerFromOpenFigi } from "../lib/openfigi";
import { createApewisdomService } from "./apewisdom-service";
import { handleMessage } from "./messages";

const store = browserStorageKvStore(browser.storage.local);
const apewisdom = createApewisdomService(store, () =>
  fetchApewisdomSnapshot(fetch),
);

browser.runtime.onMessage.addListener((message) =>
  handleMessage(
    message,
    (isin) => fetchTickerFromOpenFigi(isin, fetch),
    (ticker) => apewisdom.lookup(ticker),
  ),
);
