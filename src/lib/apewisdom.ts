const ENDPOINT = "https://apewisdom.io/api/v1.0/filter/all-stocks/page";
const DEFAULT_PAGES = 5;

export interface ApewisdomEntry {
  rank: number;
  /** Company name from the raw feed. Optional: snapshots cached before this
   *  field existed (and raw entries that omit it) have no name. */
  name?: string;
  mentions: number;
  mentions24hAgo: number;
}

export type ApewisdomSnapshot = Map<string, ApewisdomEntry>;

export type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

interface RawEntry {
  ticker: string;
  rank: number;
  name?: string;
  mentions: number;
  mentions_24h_ago: number;
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
        name: raw.name,
        mentions: raw.mentions,
        mentions24hAgo: raw.mentions_24h_ago,
      });
    }
  }
  return map;
}
