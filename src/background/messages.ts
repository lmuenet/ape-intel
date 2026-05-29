import type { ApewisdomEntry } from "../lib/apewisdom";
import type { NewsItem, EarningsDate } from "../lib/finnhub";
import type { StockTwitsEntry } from "../lib/stocktwits";
import type { TradestieEntry } from "../lib/tradestie";
import type { TickerFetcher } from "../lib/ticker-cache";

export interface TickerLookupMessage { type: "ticker:lookup"; isin: string }
export interface ApewisdomLookupMessage { type: "apewisdom:lookup"; ticker: string }
export interface TradestieLookupMessage { type: "tradestie:lookup"; ticker: string }
export interface StockTwitsLookupMessage { type: "stocktwits:lookup"; ticker: string }
export interface FinnhubNewsLookupMessage { type: "finnhub:news"; ticker: string }
export interface FinnhubEarningsLookupMessage { type: "finnhub:earnings"; ticker: string }

export type ApewisdomLookup = (ticker: string) => Promise<ApewisdomEntry | null>;
export type TradestieLookup = (ticker: string) => Promise<TradestieEntry | null>;
export type StockTwitsLookup = (ticker: string) => Promise<StockTwitsEntry | null>;
export type FinnhubNewsLookup = (ticker: string) => Promise<NewsItem[] | null>;
export type FinnhubEarningsLookup = (ticker: string) => Promise<EarningsDate | null>;

export interface MessageHandlers {
  fetchTicker: TickerFetcher;
  lookupApewisdom: ApewisdomLookup;
  lookupTradestie: TradestieLookup;
  lookupStockTwits: StockTwitsLookup;
  lookupFinnhubNews: FinnhubNewsLookup;
  lookupFinnhubEarnings: FinnhubEarningsLookup;
}

type HasTicker = { type: string; ticker: string };

function isTickerLookup(v: unknown): v is TickerLookupMessage {
  return (
    typeof v === "object" && v !== null &&
    (v as { type?: unknown }).type === "ticker:lookup" &&
    typeof (v as { isin?: unknown }).isin === "string"
  );
}

function isTypedTickerMessage<T extends string>(
  v: unknown,
  type: T,
): v is HasTicker & { type: T } {
  return (
    typeof v === "object" && v !== null &&
    (v as { type?: unknown }).type === type &&
    typeof (v as { ticker?: unknown }).ticker === "string"
  );
}

export function handleMessage(
  message: unknown,
  handlers: MessageHandlers,
):
  | Promise<string | null>
  | Promise<ApewisdomEntry | null>
  | Promise<TradestieEntry | null>
  | Promise<StockTwitsEntry | null>
  | Promise<NewsItem[] | null>
  | Promise<EarningsDate | null>
  | undefined {
  if (isTickerLookup(message)) return handlers.fetchTicker(message.isin);
  if (isTypedTickerMessage(message, "apewisdom:lookup")) return handlers.lookupApewisdom(message.ticker);
  if (isTypedTickerMessage(message, "tradestie:lookup")) return handlers.lookupTradestie(message.ticker);
  if (isTypedTickerMessage(message, "stocktwits:lookup")) return handlers.lookupStockTwits(message.ticker);
  if (isTypedTickerMessage(message, "finnhub:news")) return handlers.lookupFinnhubNews(message.ticker);
  if (isTypedTickerMessage(message, "finnhub:earnings")) return handlers.lookupFinnhubEarnings(message.ticker);
  return undefined;
}
