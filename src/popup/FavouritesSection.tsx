import { FavouriteRow } from "./FavouriteRow";
import type { FavouriteRow as Row } from "../background/favourites-board";

export interface FavouritesSectionProps {
  rows: Row[];
  openTicker?: string | null;
  onToggle?: (ticker: string) => void;
  renderExpanded?: (ticker: string) => preact.ComponentChildren;
}

export function FavouritesSection({ rows, openTicker, onToggle, renderExpanded }: FavouritesSectionProps) {
  return (
    <ol class="ape-list">
      {rows.map((row) => {
        const open = openTicker === row.ticker;
        return (
          <li class="ape-list__item" key={row.isin}>
            {onToggle ? (
              <button
                type="button"
                class="ape-list__toggle"
                aria-expanded={open}
                onClick={() => onToggle(row.ticker)}
              >
                <FavouriteRow row={row} />
              </button>
            ) : (
              <FavouriteRow row={row} />
            )}
            {open && renderExpanded ? <div class="ape-list__panel">{renderExpanded(row.ticker)}</div> : null}
          </li>
        );
      })}
    </ol>
  );
}
