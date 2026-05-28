const BASE = "https://api.stocktwits.com/api/2/streams/symbol";

export interface StockTwitsEntry {
  bullish: number;
  bearish: number;
  totalMessages: number;
}

export type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

interface RawMessage {
  entities?: { sentiment?: { basic?: "Bullish" | "Bearish" } | null };
}

interface RawResponse {
  messages?: RawMessage[];
  errors?: unknown;
}

export async function fetchStockTwitsForTicker(
  ticker: string,
  fetchFn: FetchFn,
): Promise<StockTwitsEntry | null> {
  const response = await fetchFn(`${BASE}/${ticker}.json`);
  if (!response.ok) throw new Error(`StockTwits returned ${response.status}`);
  const body = (await response.json()) as RawResponse;
  if (body.errors || !Array.isArray(body.messages)) return null;

  let bullish = 0;
  let bearish = 0;
  for (const msg of body.messages) {
    const tag = msg.entities?.sentiment?.basic;
    if (tag === "Bullish") bullish++;
    else if (tag === "Bearish") bearish++;
  }
  return { bullish, bearish, totalMessages: body.messages.length };
}
