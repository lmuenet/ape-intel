import "./badge.css";

export interface BadgeProps {
  isin: string;
}

export function Badge({ isin }: BadgeProps) {
  return (
    <div class="ape-intel-badge" role="status" aria-label="Ape Intel">
      <span class="ape-intel-badge__brand">Ape Intel</span>
      <span class="ape-intel-badge__isin">{isin}</span>
    </div>
  );
}
