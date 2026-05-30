import { FavouriteRow } from "./FavouriteRow";
import type { FavouriteRow as Row } from "../background/favourites-board";

export function FavouritesSection({ rows }: { rows: Row[] }) {
  return (
    <ol class="ape-list">
      {rows.map((row) => (
        <li class="ape-list__item" key={row.isin}>
          <FavouriteRow row={row} />
        </li>
      ))}
    </ol>
  );
}
