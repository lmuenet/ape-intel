import { useEffect, useState } from "preact/hooks";
import type { TrendingRow } from "../background/apewisdom-service";
import type { FavouriteRow } from "../background/favourites-board";
import { TrendingSection } from "./TrendingSection";
import "./popup.css";

export type Send = <T>(message: unknown) => Promise<T>;

const defaultSend: Send = async (message) =>
  (await browser.runtime.sendMessage(message)) as never;

// undefined = loading, null = error, [] = loaded-but-empty
type Loadable<T> = T[] | null | undefined;

export function App({ send = defaultSend }: { send?: Send }) {
  const [trending, setTrending] = useState<Loadable<TrendingRow>>(undefined);
  const [favourites, setFavourites] = useState<Loadable<FavouriteRow>>(undefined);

  useEffect(() => {
    send<TrendingRow[]>({ type: "trending:board" }).then(setTrending, () => setTrending(null));
    send<FavouriteRow[]>({ type: "favourites:board" }).then(setFavourites, () => setFavourites(null));
  }, [send]);

  return (
    <div class="ape-popup">
      <header class="ape-popup__brand">Ape Intel</header>

      <section class="ape-popup__section">
        <h2 class="ape-popup__title">Trending</h2>
        <Section state={trending} empty="Nothing trending right now.">
          {(rows) => <TrendingSection rows={rows} />}
        </Section>
      </section>

      <section class="ape-popup__section">
        <h2 class="ape-popup__title">Favourites</h2>
        <Section state={favourites} empty="No favourites yet — pin Assets on a broker page.">
          {(rows) => <p class="ape-popup__count">{rows.length} favourites</p>}
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
