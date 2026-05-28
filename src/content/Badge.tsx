import "./badge.css";

export interface BadgeProps {
  isin: string;
  ticker?: string | null;
  onClick?: () => void;
}

export function Badge({ isin, ticker, onClick }: BadgeProps) {
  return (
    <button
      type="button"
      class="ape-intel-badge"
      aria-label="Open Ape Intel side panel"
      onClick={onClick}
    >
      <span class="ape-intel-badge__brand">Ape Intel</span>
      <span class="ape-intel-badge__isin">{isin}</span>
      {ticker ? (
        <span class="ape-intel-badge__ticker">{ticker}</span>
      ) : null}
    </button>
  );
}
