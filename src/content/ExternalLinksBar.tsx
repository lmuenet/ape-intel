export interface ExternalLinksBarProps {
  ticker: string | null | undefined;
}

interface ExternalLink {
  href: (ticker: string) => string;
  label: string;
  emoji: string;
}

const LINKS: ExternalLink[] = [
  {
    label: "TradingView",
    emoji: "📈",
    href: (t) => `https://www.tradingview.com/chart/?symbol=${t}`,
  },
  {
    label: "Quiver",
    emoji: "🏛",
    href: (t) => `https://www.quiverquant.com/stocks/${t}/`,
  },
];

export function ExternalLinksBar({ ticker }: ExternalLinksBarProps) {
  if (!ticker) return null;
  return (
    <nav class="ape-intel-links" aria-label="External tools for this ticker">
      {LINKS.map((link) => (
        <a
          key={link.label}
          class="ape-intel-links__item"
          href={link.href(ticker)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span class="ape-intel-links__emoji" aria-hidden="true">{link.emoji}</span>
          <span class="ape-intel-links__label">{link.label}</span>
        </a>
      ))}
    </nav>
  );
}
