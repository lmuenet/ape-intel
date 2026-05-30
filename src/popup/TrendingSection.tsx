import { TrendingRow } from "./TrendingRow";
import type { TrendingRow as Row } from "../background/apewisdom-service";

export function TrendingSection({ rows }: { rows: Row[] }) {
  return (
    <ol class="ape-list">
      {rows.map((row) => (
        <li class="ape-list__item" key={row.ticker}>
          <TrendingRow row={row} />
        </li>
      ))}
    </ol>
  );
}
