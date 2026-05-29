import { CATALYST_LABEL } from "../lib/catalyst";
import type { EarningsDate, NewsItem } from "../lib/finnhub";

export interface NewsSectionProps {
  hasKey: boolean;
  news: NewsItem[] | null | undefined;
  onSaveKey: (key: string) => void;
}

export interface EarningsRowProps {
  earnings: EarningsDate | null | undefined;
}

function newsDate(datetime: number): string {
  return new Date(datetime * 1000).toISOString().slice(0, 10);
}

function KeyForm({ onSaveKey }: { onSaveKey: (key: string) => void }) {
  const onSubmit = (e: Event) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const input = form.elements.namedItem("finnhubKey") as HTMLInputElement | null;
    const value = input?.value.trim() ?? "";
    if (value) onSaveKey(value);
  };
  return (
    <form class="ape-intel-news__keyform" onSubmit={onSubmit}>
      <input type="text" name="finnhubKey" placeholder="Finnhub API key" class="ape-intel-news__keyinput" />
      <button type="submit" class="ape-intel-news__keysave">Save</button>
    </form>
  );
}

export function NewsSection({ hasKey, news, onSaveKey }: NewsSectionProps) {
  return (
    <section class="ape-intel-panel__source ape-intel-news">
      <h3 class="ape-intel-panel__section-title">News</h3>
      {!hasKey ? <KeyForm onSaveKey={onSaveKey} />
      : news === undefined ? <p class="ape-intel-panel__placeholder">Loading…</p>
      : news === null ? <p class="ape-intel-panel__placeholder">Couldn't load news.</p>
      : news.length === 0 ? <p class="ape-intel-panel__placeholder">No news in the last 7 days.</p>
      : (
        <ul class="ape-intel-news__list">
          {news.map((it) => (
            <li class="ape-intel-news__item" key={it.url}>
              <a class="ape-intel-news__headline" href={it.url} target="_blank" rel="noopener noreferrer">
                {it.headline}
              </a>
              <div class="ape-intel-news__meta">
                <span class="ape-intel-news__tag" data-catalyst={it.catalyst}>{CATALYST_LABEL[it.catalyst]}</span>
                {it.source ? <span class="ape-intel-news__source">{it.source}</span> : null}
                <span class="ape-intel-news__date">{newsDate(it.datetime)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function EarningsRow({ earnings }: EarningsRowProps) {
  return (
    <section class="ape-intel-panel__source ape-intel-earnings">
      <h3 class="ape-intel-panel__section-title">Next earnings</h3>
      {earnings === undefined ? <p class="ape-intel-panel__placeholder">Loading…</p>
      : earnings === null ? <p class="ape-intel-panel__placeholder">No upcoming earnings date.</p>
      : (
        <p class="ape-intel-earnings__value">
          {earnings.date}
          {earnings.epsEstimate !== null
            ? <span class="ape-intel-earnings__eps"> · EPS est. {earnings.epsEstimate}</span>
            : null}
        </p>
      )}
    </section>
  );
}
