import type { ApewisdomEntry } from "../lib/apewisdom";
import type { TickerFetcher } from "../lib/ticker-cache";

export interface TickerLookupMessage {
  type: "ticker:lookup";
  isin: string;
}

export interface ApewisdomLookupMessage {
  type: "apewisdom:lookup";
  ticker: string;
}

export type ApewisdomLookup = (
  ticker: string,
) => Promise<ApewisdomEntry | null>;

function isTickerLookup(value: unknown): value is TickerLookupMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === "ticker:lookup" &&
    typeof (value as { isin?: unknown }).isin === "string"
  );
}

function isApewisdomLookup(value: unknown): value is ApewisdomLookupMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === "apewisdom:lookup" &&
    typeof (value as { ticker?: unknown }).ticker === "string"
  );
}

export function handleMessage(
  message: unknown,
  fetchTicker: TickerFetcher,
  lookupApewisdom: ApewisdomLookup,
): Promise<string | null> | Promise<ApewisdomEntry | null> | undefined {
  if (isTickerLookup(message)) return fetchTicker(message.isin);
  if (isApewisdomLookup(message)) return lookupApewisdom(message.ticker);
  return undefined;
}
