export interface ExternalLinksBarProps {
  ticker: string | null | undefined;
  onTradingViewClick: () => void;
}

export function ExternalLinksBar({ ticker, onTradingViewClick }: ExternalLinksBarProps) {
  if (!ticker) return null;
  return (
    <nav class="ape-intel-links" aria-label="External tools for this ticker">
      <button
        type="button"
        class="ape-intel-links__item ape-intel-links__item--button"
        onClick={onTradingViewClick}
      >
        <span class="ape-intel-links__emoji" aria-hidden="true">📈</span>
        <span class="ape-intel-links__label">TradingView</span>
      </button>
      <a
        class="ape-intel-links__item"
        href={`https://www.quiverquant.com/stock/${ticker}/`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <span class="ape-intel-links__emoji" aria-hidden="true">🏛</span>
        <span class="ape-intel-links__label">Quiver</span>
      </a>
    </nav>
  );
}
