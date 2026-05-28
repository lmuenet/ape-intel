const ENDPOINT = "https://tradestie.com/api/v1/apps/reddit";

export interface TradestieEntry {
  comments: number;
  sentimentLabel: "Bullish" | "Bearish" | "Neutral";
  sentimentScore: number;
}

export type TradestieSnapshot = Map<string, TradestieEntry>;

export type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

interface RawEntry {
  ticker: string;
  no_of_comments: number;
  sentiment: TradestieEntry["sentimentLabel"];
  sentiment_score: number;
}

export async function fetchTradestieSnapshot(
  fetchFn: FetchFn,
): Promise<TradestieSnapshot> {
  const response = await fetchFn(ENDPOINT);
  if (!response.ok) throw new Error(`Tradestie returned ${response.status}`);
  const body = (await response.json()) as RawEntry[];
  const map: TradestieSnapshot = new Map();
  for (const raw of body) {
    map.set(raw.ticker, {
      comments: raw.no_of_comments,
      sentimentLabel: raw.sentiment,
      sentimentScore: raw.sentiment_score,
    });
  }
  return map;
}
