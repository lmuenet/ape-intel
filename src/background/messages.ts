import type { ApewisdomEntry } from "../lib/apewisdom";
import type { NewsItem, EarningsDate } from "../lib/finnhub";
import type { StockTwitsEntry } from "../lib/stocktwits";
import type { TradestieEntry } from "../lib/tradestie";
import type { TickerFetcher } from "../lib/ticker-cache";
import type { Favourite } from "../lib/favourites";
import type { DailySnapshot } from "../lib/snapshot-history";
import type { TrendingRow } from "./apewisdom-service";
import type { FavouriteRow } from "./favourites-board";
import type { LogEntry } from "../lib/logger";

export interface TickerLookupMessage { type: "ticker:lookup"; isin: string }
export interface ApewisdomLookupMessage { type: "apewisdom:lookup"; ticker: string; force?: boolean }
export interface TradestieLookupMessage { type: "tradestie:lookup"; ticker: string }
export interface StockTwitsLookupMessage { type: "stocktwits:lookup"; ticker: string; force?: boolean }
export interface FinnhubNewsLookupMessage { type: "finnhub:news"; ticker: string; force?: boolean }
export interface FinnhubEarningsLookupMessage { type: "finnhub:earnings"; ticker: string; force?: boolean }
export interface FavouriteToggleMessage { type: "favourites:toggle"; isin: string; ticker: string }
export interface FavouriteHasMessage { type: "favourites:has"; isin: string }
export interface SnapshotHistoryMessage { type: "snapshot:history"; isin: string }
export interface TrendingBoardMessage { type: "trending:board" }
export interface FavouritesBoardMessage { type: "favourites:board" }
export interface LogMessage { type: "log"; entry: LogEntry }

export type ApewisdomLookup = (ticker: string, force?: boolean) => Promise<ApewisdomEntry | null>;
export type TradestieLookup = (ticker: string) => Promise<TradestieEntry | null>;
export type StockTwitsLookup = (ticker: string, force?: boolean) => Promise<StockTwitsEntry | null>;
export type FinnhubNewsLookup = (ticker: string, force?: boolean) => Promise<NewsItem[] | null>;
export type FinnhubEarningsLookup = (ticker: string, force?: boolean) => Promise<EarningsDate | null>;
export type FavouriteToggle = (fav: Favourite) => Promise<boolean>;
export type FavouriteHas = (isin: string) => Promise<boolean>;
export type SnapshotHistoryLookup = (isin: string) => Promise<DailySnapshot[]>;
export type TrendingBoardLookup = () => Promise<TrendingRow[]>;
export type FavouritesBoardLookup = () => Promise<FavouriteRow[]>;
export type AppendLog = (entry: LogEntry) => Promise<void>;

export interface MessageHandlers {
  fetchTicker: TickerFetcher;
  lookupApewisdom: ApewisdomLookup;
  lookupTradestie: TradestieLookup;
  lookupStockTwits: StockTwitsLookup;
  lookupFinnhubNews: FinnhubNewsLookup;
  lookupFinnhubEarnings: FinnhubEarningsLookup;
  toggleFavourite: FavouriteToggle;
  isFavourite: FavouriteHas;
  getSnapshotHistory: SnapshotHistoryLookup;
  getTrendingBoard: TrendingBoardLookup;
  getFavouritesBoard: FavouritesBoardLookup;
  appendLog: AppendLog;
}

function isLogMessage(v: unknown): v is LogMessage {
  return (
    typeof v === "object" && v !== null &&
    (v as { type?: unknown }).type === "log" &&
    typeof (v as { entry?: unknown }).entry === "object" &&
    (v as { entry?: unknown }).entry !== null
  );
}

type HasTicker = { type: string; ticker: string };

function isTickerLookup(v: unknown): v is TickerLookupMessage {
  return (
    typeof v === "object" && v !== null &&
    (v as { type?: unknown }).type === "ticker:lookup" &&
    typeof (v as { isin?: unknown }).isin === "string"
  );
}

type HasIsin = { type: string; isin: string };

function isTypedIsinMessage<T extends string>(
  v: unknown,
  type: T,
): v is HasIsin & { type: T } {
  return (
    typeof v === "object" && v !== null &&
    (v as { type?: unknown }).type === type &&
    typeof (v as { isin?: unknown }).isin === "string"
  );
}

function isFavouriteToggle(v: unknown): v is FavouriteToggleMessage {
  return (
    typeof v === "object" && v !== null &&
    (v as { type?: unknown }).type === "favourites:toggle" &&
    typeof (v as { isin?: unknown }).isin === "string" &&
    typeof (v as { ticker?: unknown }).ticker === "string"
  );
}

function isTypedMessage<T extends string>(v: unknown, type: T): v is { type: T } {
  return typeof v === "object" && v !== null && (v as { type?: unknown }).type === type;
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
  | Promise<boolean>
  | Promise<DailySnapshot[]>
  | Promise<TrendingRow[]>
  | Promise<FavouriteRow[]>
  | Promise<void>
  | undefined {
  if (isTickerLookup(message)) return handlers.fetchTicker(message.isin);
  if (isTypedTickerMessage(message, "apewisdom:lookup")) return handlers.lookupApewisdom(message.ticker, (message as ApewisdomLookupMessage).force);
  if (isTypedTickerMessage(message, "tradestie:lookup")) return handlers.lookupTradestie(message.ticker);
  if (isTypedTickerMessage(message, "stocktwits:lookup")) return handlers.lookupStockTwits(message.ticker, (message as StockTwitsLookupMessage).force);
  if (isTypedTickerMessage(message, "finnhub:news")) return handlers.lookupFinnhubNews(message.ticker, (message as FinnhubNewsLookupMessage).force);
  if (isTypedTickerMessage(message, "finnhub:earnings")) return handlers.lookupFinnhubEarnings(message.ticker, (message as FinnhubEarningsLookupMessage).force);
  if (isFavouriteToggle(message)) return handlers.toggleFavourite({ isin: message.isin, ticker: message.ticker });
  if (isTypedIsinMessage(message, "favourites:has")) return handlers.isFavourite(message.isin);
  if (isTypedIsinMessage(message, "snapshot:history")) return handlers.getSnapshotHistory(message.isin);
  if (isTypedMessage(message, "trending:board")) return handlers.getTrendingBoard();
  if (isTypedMessage(message, "favourites:board")) return handlers.getFavouritesBoard();
  if (isLogMessage(message)) return handlers.appendLog(message.entry);
  return undefined;
}
