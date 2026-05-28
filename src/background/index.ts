import { fetchTickerFromOpenFigi } from "../lib/openfigi";
import { handleMessage } from "./messages";

browser.runtime.onMessage.addListener((message) =>
  handleMessage(message, (isin) => fetchTickerFromOpenFigi(isin, fetch)),
);
