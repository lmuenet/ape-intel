import type { TickerFetcher } from "../lib/ticker-cache";

export interface TickerLookupMessage {
  type: "ticker:lookup";
  isin: string;
}

function isTickerLookup(value: unknown): value is TickerLookupMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === "ticker:lookup" &&
    typeof (value as { isin?: unknown }).isin === "string"
  );
}

export function handleMessage(
  message: unknown,
  fetchTicker: TickerFetcher,
): Promise<string | null> | undefined {
  if (!isTickerLookup(message)) return undefined;
  return fetchTicker(message.isin);
}
