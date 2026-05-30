const ISIN_PATTERN = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;

export function isValidIsin(value: unknown): value is string {
  return typeof value === "string" && ISIN_PATTERN.test(value);
}

/**
 * A supported Broker: identified by host, knows how to pull a candidate ISIN
 * out of one of its security-page URLs. Adding a Broker is one entry here plus
 * one `content_scripts` match in the manifest (see ADR-0006). Every Broker so
 * far exposes the ISIN in the URL — no DOM scraping.
 */
export interface Broker {
  id: string;
  matchesHost(url: URL): boolean;
  /** Candidate ISIN (still unvalidated), or null if the URL isn't an asset page. */
  extractIsin(url: URL): string | null;
}

export const BROKERS: Broker[] = [
  {
    id: "scalable",
    matchesHost: (url) => url.hostname === "de.scalable.capital",
    extractIsin: (url) =>
      url.pathname === "/broker/security" ? url.searchParams.get("isin") : null,
  },
  {
    id: "smartbroker-plus",
    matchesHost: (url) => url.hostname === "app.smartbrokerplus.de",
    // .../p/<portfolioId>/assets/<ISIN>[/]
    extractIsin: (url) => {
      const match = url.pathname.match(/\/assets\/([^/]+)\/?$/);
      return match ? match[1] : null;
    },
  },
];

export function parseIsinFromUrl(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  for (const broker of BROKERS) {
    if (!broker.matchesHost(url)) continue;
    const candidate = broker.extractIsin(url);
    return isValidIsin(candidate) ? candidate : null;
  }
  return null;
}
