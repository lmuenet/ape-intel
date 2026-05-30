import { TrendingRow } from "./TrendingRow";
import type { TrendingRow as Row } from "../background/apewisdom-service";

export interface TrendingSectionProps {
  rows: Row[];
  openTicker?: string | null;
  onToggle?: (ticker: string) => void;
  renderExpanded?: (ticker: string) => preact.ComponentChildren;
}

export function TrendingSection({ rows, openTicker, onToggle, renderExpanded }: TrendingSectionProps) {
  return (
    <ol class="ape-list">
      {rows.map((row) => {
        const open = openTicker === row.ticker;
        return (
          <li class="ape-list__item" key={row.ticker}>
            {onToggle ? (
              <button
                type="button"
                class="ape-list__toggle"
                aria-expanded={open}
                onClick={() => onToggle(row.ticker)}
              >
                <TrendingRow row={row} />
              </button>
            ) : (
              <TrendingRow row={row} />
            )}
            {open && renderExpanded ? <div class="ape-list__panel">{renderExpanded(row.ticker)}</div> : null}
          </li>
        );
      })}
    </ol>
  );
}
