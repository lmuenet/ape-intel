import "./badge.css";

export interface BadgeProps {
  isin: string;
  ticker?: string | null;
}

export function Badge({ isin, ticker }: BadgeProps) {
  return (
    <div class="ape-intel-badge" role="status" aria-label="Ape Intel">
      <span class="ape-intel-badge__brand">Ape Intel</span>
      <span class="ape-intel-badge__isin">{isin}</span>
      {ticker ? (
        <span class="ape-intel-badge__ticker">{ticker}</span>
      ) : null}
    </div>
  );
}
