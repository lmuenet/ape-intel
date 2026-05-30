import type { KvStore } from "../lib/kv-store";
import type { Favourite } from "../lib/favourites";
import type { ApewisdomSnapshot } from "../lib/apewisdom";
import {
  appendDay,
  isSnapshotDue,
  utcDay,
  type DailySnapshot,
} from "../lib/snapshot-history";

const LAST_DATE_KEY = "snapshot:lastDate";
const HISTORY_PREFIX = "snapshot:history:";

export type FavouritesSource = () => Promise<Favourite[]>;
export type SnapshotFetcher = () => Promise<ApewisdomSnapshot>;

export interface SnapshotService {
  runIfDue(now: number): Promise<void>;
  history(isin: string): Promise<DailySnapshot[]>;
}

export function createSnapshotService(
  store: KvStore,
  getFavourites: FavouritesSource,
  fetchSnapshot: SnapshotFetcher,
): SnapshotService {
  async function history(isin: string): Promise<DailySnapshot[]> {
    return (await store.get<DailySnapshot[]>(`${HISTORY_PREFIX}${isin}`)) ?? [];
  }

  return {
    history,
    async runIfDue(now: number): Promise<void> {
      const today = utcDay(now);
      const lastDate = await store.get<string>(LAST_DATE_KEY);
      if (!isSnapshotDue(lastDate, today)) return;

      const favourites = await getFavourites();
      if (favourites.length === 0) return;

      const apewisdom = await fetchSnapshot();
      for (const fav of favourites) {
        const entry = apewisdom.get(fav.ticker);
        const record: DailySnapshot = {
          date: today,
          mentions: entry?.mentions ?? 0,
          rank: entry?.rank ?? null,
        };
        const next = appendDay(await history(fav.isin), record);
        await store.set(`${HISTORY_PREFIX}${fav.isin}`, next);
      }
      await store.set(LAST_DATE_KEY, today);
    },
  };
}
