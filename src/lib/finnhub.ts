import { classifyCatalyst, type CatalystTag } from "./catalyst";

const NEWS_ENDPOINT = "https://finnhub.io/api/v1/company-news";

export interface NewsItem {
  headline: string;
  source: string;
  url: string;
  datetime: number;
  catalyst: CatalystTag;
}

export type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface RawNews {
  headline?: string;
  source?: string;
  url?: string;
  datetime?: number;
}

function ymd(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export async function fetchCompanyNews(
  ticker: string,
  apiKey: string,
  fetchFn: FetchFn,
  now: number = Date.now(),
): Promise<NewsItem[]> {
  const to = ymd(now);
  const from = ymd(now - 7 * 24 * 60 * 60 * 1000);
  const url =
    `${NEWS_ENDPOINT}?symbol=${encodeURIComponent(ticker)}&from=${from}&to=${to}` +
    `&token=${encodeURIComponent(apiKey)}`;

  const response = await fetchFn(url);
  if (!response.ok) throw new Error(`Finnhub news returned ${response.status}`);

  const body = (await response.json()) as RawNews[];
  if (!Array.isArray(body)) return [];

  const items: NewsItem[] = [];
  for (const r of body) {
    if (typeof r.headline !== "string" || r.headline.length === 0) continue;
    if (typeof r.url !== "string" || r.url.length === 0) continue;
    items.push({
      headline: r.headline,
      source: r.source ?? "",
      url: r.url,
      datetime: r.datetime ?? 0,
      catalyst: classifyCatalyst(r.headline),
    });
  }
  items.sort((a, b) => b.datetime - a.datetime);
  return items.slice(0, 5);
}
