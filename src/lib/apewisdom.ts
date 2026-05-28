const ENDPOINT = "https://apewisdom.io/api/v1.0/filter/all-stocks/page";
const DEFAULT_PAGES = 5;

export interface ApewisdomEntry {
  rank: number;
  mentions: number;
  mentions24hAgo: number;
  sentimentScore: number;
}

export type ApewisdomSnapshot = Map<string, ApewisdomEntry>;

export type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

interface RawEntry {
  ticker: string;
  rank: number;
  mentions: number;
  mentions_24h_ago: number;
  sentiment_score: number;
}

interface RawPage {
  results: RawEntry[];
}

export async function fetchApewisdomSnapshot(
  fetchFn: FetchFn,
  pages: number = DEFAULT_PAGES,
): Promise<ApewisdomSnapshot> {
  const map: ApewisdomSnapshot = new Map();
  for (let page = 1; page <= pages; page++) {
    const response = await fetchFn(`${ENDPOINT}/${page}`);
    if (!response.ok) {
      throw new Error(`Apewisdom returned ${response.status}`);
    }
    const body = (await response.json()) as RawPage;
    for (const raw of body.results ?? []) {
      map.set(raw.ticker, {
        rank: raw.rank,
        mentions: raw.mentions,
        mentions24hAgo: raw.mentions_24h_ago,
        sentimentScore: raw.sentiment_score,
      });
    }
  }
  return map;
}
