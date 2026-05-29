export type CatalystTag =
  | "earnings" | "m&a" | "guidance" | "analyst" | "regulatory" | "product" | "news";

// Ordered: first match wins. earnings before guidance; m&a before product.
const RULES: Array<{ tag: CatalystTag; pattern: RegExp }> = [
  { tag: "earnings", pattern: /\b(earnings|eps|quarterly results|q[1-4]|beats?|misses?|revenue)\b/i },
  { tag: "m&a", pattern: /\b(acquir\w*|merger|buyout|takeover|acquisition)\b/i },
  { tag: "guidance", pattern: /\b(guidance|outlook|forecast|raises|cuts|lowers)\b/i },
  { tag: "analyst", pattern: /\b(upgrades?|downgrades?|price target|initiates|rating)\b/i },
  { tag: "regulatory", pattern: /\b(fda|approval|lawsuit|sec|investigation|antitrust|probe|recall)\b/i },
  { tag: "product", pattern: /\b(launch\w*|unveils?|releases?|product)\b/i },
];

export function classifyCatalyst(headline: string): CatalystTag {
  for (const { tag, pattern } of RULES) {
    if (pattern.test(headline)) return tag;
  }
  return "news";
}

export const CATALYST_LABEL: Record<CatalystTag, string> = {
  earnings: "Earnings",
  "m&a": "M&A",
  guidance: "Guidance",
  analyst: "Analyst",
  regulatory: "Regulatory",
  product: "Product",
  news: "News",
};
