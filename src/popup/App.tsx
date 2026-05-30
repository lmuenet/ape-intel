import { useEffect, useState } from "preact/hooks";
import type { ApewisdomEntry } from "../lib/apewisdom";
import type { StockTwitsEntry } from "../lib/stocktwits";
import type { EarningsDate, NewsItem } from "../lib/finnhub";
import type { TrendingRow } from "../background/apewisdom-service";
import type { FavouriteRow } from "../background/favourites-board";
import { browserStorageKvStore } from "../lib/kv-store";
import { TrendingSection } from "./TrendingSection";
import { FavouritesSection } from "./FavouritesSection";
import { ExpandedIntel } from "./ExpandedIntel";
import "./popup.css";

export type Send = <T>(message: unknown) => Promise<T>;

const defaultSend: Send = async (message) =>
  (await browser.runtime.sendMessage(message)) as never;

const defaultHasFinnhubKey = async (): Promise<boolean> =>
  Boolean(await browserStorageKvStore(browser.storage.local).get<string>("finnhub:apiKey"));

// undefined = loading, null = error, [] = loaded-but-empty
type Loadable<T> = T[] | null | undefined;

interface Intel {
  stocktwits: StockTwitsEntry | null | undefined;
  news: NewsItem[] | null | undefined;
  earnings: EarningsDate | null | undefined;
}

export interface AppProps {
  send?: Send;
  getHasFinnhubKey?: () => Promise<boolean>;
}

export function App({ send = defaultSend, getHasFinnhubKey = defaultHasFinnhubKey }: AppProps) {
  const [trending, setTrending] = useState<Loadable<TrendingRow>>(undefined);
  const [favourites, setFavourites] = useState<Loadable<FavouriteRow>>(undefined);
  const [open, setOpen] = useState<string | null>(null);
  const [intel, setIntel] = useState<Record<string, Intel>>({});
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    send<TrendingRow[]>({ type: "trending:board" }).then(setTrending, () => setTrending(null));
    send<FavouriteRow[]>({ type: "favourites:board" }).then(setFavourites, () => setFavourites(null));
    getHasFinnhubKey().then(setHasKey, () => setHasKey(false));
  }, [send, getHasFinnhubKey]);

  function apewisdomFor(ticker: string): ApewisdomEntry | null {
    const t = (trending ?? []).find((r) => r.ticker === ticker);
    if (t) return { rank: t.rank, name: t.name, mentions: t.mentions, mentions24hAgo: t.mentions24hAgo };
    const f = (favourites ?? []).find((r) => r.ticker === ticker);
    return f?.standing ?? null;
  }

  function fetchIntel(ticker: string): void {
    setIntel((prev) => ({ ...prev, [ticker]: { stocktwits: undefined, news: undefined, earnings: undefined } }));
    const patch = (p: Partial<Intel>) =>
      setIntel((prev) => ({ ...prev, [ticker]: { ...prev[ticker], ...p } }));

    send<StockTwitsEntry | null>({ type: "stocktwits:lookup", ticker }).then(
      (stocktwits) => patch({ stocktwits }),
      () => patch({ stocktwits: null }),
    );
    if (hasKey) {
      send<NewsItem[] | null>({ type: "finnhub:news", ticker }).then(
        (news) => patch({ news }),
        () => patch({ news: null }),
      );
      send<EarningsDate | null>({ type: "finnhub:earnings", ticker }).then(
        (earnings) => patch({ earnings }),
        () => patch({ earnings: null }),
      );
    } else {
      patch({ news: null, earnings: null });
    }
  }

  function onToggle(ticker: string): void {
    setOpen((prev) => (prev === ticker ? null : ticker));
    if (open !== ticker && !intel[ticker]) fetchIntel(ticker);
  }

  const renderExpanded = (ticker: string) => {
    const data = intel[ticker];
    return (
      <ExpandedIntel
        ticker={ticker}
        apewisdom={apewisdomFor(ticker)}
        stocktwits={data?.stocktwits}
        news={data?.news}
        earnings={data?.earnings}
        hasKey={hasKey}
      />
    );
  };

  return (
    <div class="ape-popup">
      <header class="ape-popup__brand">Ape Intel</header>

      <section class="ape-popup__section">
        <h2 class="ape-popup__title">Trending</h2>
        <Section state={trending} empty="Nothing trending right now.">
          {(rows) => (
            <TrendingSection rows={rows} openTicker={open} onToggle={onToggle} renderExpanded={renderExpanded} />
          )}
        </Section>
      </section>

      <section class="ape-popup__section">
        <h2 class="ape-popup__title">Favourites</h2>
        <Section state={favourites} empty="No favourites yet — pin Assets on a broker page.">
          {(rows) => (
            <FavouritesSection rows={rows} openTicker={open} onToggle={onToggle} renderExpanded={renderExpanded} />
          )}
        </Section>
      </section>
    </div>
  );
}

function Section<T>(props: {
  state: Loadable<T>;
  empty: string;
  children: (rows: T[]) => preact.ComponentChildren;
}) {
  if (props.state === undefined) return <p class="ape-popup__hint">Loading…</p>;
  if (props.state === null) return <p class="ape-popup__hint ape-popup__hint--error">Couldn’t load.</p>;
  if (props.state.length === 0) return <p class="ape-popup__hint">{props.empty}</p>;
  return <>{props.children(props.state)}</>;
}
