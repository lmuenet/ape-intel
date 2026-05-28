const ENDPOINT = "https://api.openfigi.com/v3/mapping";

interface OpenFigiResponseItem {
  data?: Array<{ ticker?: string }>;
  warning?: string;
}

export type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export async function fetchTickerFromOpenFigi(
  isin: string,
  fetchFn: FetchFn,
): Promise<string | null> {
  const response = await fetchFn(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([
      { idType: "ID_ISIN", idValue: isin, exchCode: "US" },
    ]),
  });

  if (!response.ok) {
    throw new Error(`OpenFIGI returned ${response.status}`);
  }

  const payload = (await response.json()) as OpenFigiResponseItem[];
  const first = payload[0];
  const ticker = first?.data?.[0]?.ticker;
  return ticker ?? null;
}
