import { useEffect, useState } from "preact/hooks";
import type { ApewisdomEntry } from "../lib/apewisdom";
import type { StockTwitsEntry } from "../lib/stocktwits";
import type { EarningsDate, NewsItem } from "../lib/finnhub";
import type { TrendingRow } from "../background/apewisdom-service";
import type { FavouriteRow } from "../background/favourites-board";
import { browserStorageKvStore } from "../lib/kv-store";
import {
  parseTrendingChallenge,
  type StoredTrendingChallenge,
  type TickerVerdict,
} from "../lib/trending-challenge";
import { buildTrendingClipboardPayload } from "../lib/trending-briefing";
import { TrendingSection } from "./TrendingSection";
import { FavouritesSection } from "./FavouritesSection";
import { ExpandedIntel } from "./ExpandedIntel";
import { ChallengePanel } from "./ChallengePanel";
import "./popup.css";

export type Send = <T>(message: unknown) => Promise<T>;

const defaultSend: Send = async (message) =>
  (await browser.runtime.sendMessage(message)) as never;

const defaultHasFinnhubKey = async (): Promise<boolean> =>
  Boolean(await browserStorageKvStore(browser.storage.local).get<string>("finnhub:apiKey"));

const CHALLENGE_KEY = "trending:challenge";

const defaultLoadChallenge = async (): Promise<StoredTrendingChallenge | null> =>
  (await browserStorageKvStore(browser.storage.local).get<StoredTrendingChallenge>(CHALLENGE_KEY)) ?? null;

const defaultSaveChallenge = async (c: StoredTrendingChallenge | null): Promise<void> => {
  const store = browserStorageKvStore(browser.storage.local);
  if (c) await store.set(CHALLENGE_KEY, c);
  else await store.remove(CHALLENGE_KEY);
};

function sameTickers(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((t) => set.has(t));
}

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
  loadChallenge?: () => Promise<StoredTrendingChallenge | null>;
  saveChallenge?: (c: StoredTrendingChallenge | null) => Promise<void>;
  writeClipboard?: (text: string) => Promise<void>;
}

export function App({
  send = defaultSend,
  getHasFinnhubKey = defaultHasFinnhubKey,
  loadChallenge = defaultLoadChallenge,
  saveChallenge = defaultSaveChallenge,
  writeClipboard = (text) => navigator.clipboard.writeText(text),
}: AppProps) {
  const [trending, setTrending] = useState<Loadable<TrendingRow>>(undefined);
  const [favourites, setFavourites] = useState<Loadable<FavouriteRow>>(undefined);
  const [open, setOpen] = useState<string | null>(null);
  const [intel, setIntel] = useState<Record<string, Intel>>({});
  const [hasKey, setHasKey] = useState(false);
  const [challenge, setChallenge] = useState<StoredTrendingChallenge | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [parseError, setParseError] = useState(false);

  useEffect(() => {
    send<TrendingRow[]>({ type: "trending:board" }).then(setTrending, () => setTrending(null));
    send<FavouriteRow[]>({ type: "favourites:board" }).then(setFavourites, () => setFavourites(null));
    getHasFinnhubKey().then(setHasKey, () => setHasKey(false));
    loadChallenge().then(setChallenge, () => setChallenge(null));
  }, [send, getHasFinnhubKey, loadChallenge]);

  function onCopyChallenge(): void {
    writeClipboard(buildTrendingClipboardPayload(trending ?? [])).then(
      () => setCopyState("copied"),
      () => setCopyState("error"),
    );
  }

  function onApplyChallenge(text: string): void {
    const parsed = parseTrendingChallenge(text);
    if (!parsed) {
      setParseError(true);
      return;
    }
    const stored: StoredTrendingChallenge = {
      ...parsed,
      ingestedAt: new Date().toISOString(),
      tickers: (trending ?? []).map((r) => r.ticker),
    };
    setParseError(false);
    setCopyState("idle");
    setChallenge(stored);
    void saveChallenge(stored);
  }

  function onClearChallenge(): void {
    setChallenge(null);
    setParseError(false);
    void saveChallenge(null);
  }

  const verdictFor = (ticker: string): TickerVerdict | undefined =>
    challenge?.verdicts.find((v) => v.ticker === ticker);

  const stale =
    challenge !== null &&
    Array.isArray(trending) &&
    !sameTickers(challenge.tickers, trending.map((r) => r.ticker));

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

      <div class="ape-popup__cols">
      <section class="ape-popup__section">
        <h2 class="ape-popup__title">Trending</h2>
        <ChallengePanel
          copyState={copyState}
          onCopy={onCopyChallenge}
          challenge={challenge}
          stale={stale}
          parseError={parseError}
          onApply={onApplyChallenge}
          onClear={onClearChallenge}
        />
        <Section state={trending} empty="Nothing trending right now.">
          {(rows) => (
            <TrendingSection
              rows={rows}
              openTicker={open}
              onToggle={onToggle}
              renderExpanded={renderExpanded}
              verdictFor={verdictFor}
            />
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
