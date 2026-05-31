import { useEffect, useState } from "preact/hooks";

export interface KeySectionProps {
  value: string;
  onSave: (key: string) => void;
  onDelete: () => void;
}

export function KeySection({ value, onSave, onDelete }: KeySectionProps) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const saved = value.trim().length > 0;

  return (
    <section class="ape-options__section">
      <h2 class="ape-options__title">Finnhub API key</h2>
      <p class="ape-options__hint">
        {saved ? "Key is set." : "No key set — News and Earnings are disabled."}
      </p>
      <div class="ape-options__row">
        <input
          class="ape-options__input"
          type="text"
          aria-label="Finnhub API key"
          value={draft}
          placeholder="Paste your Finnhub key"
          onInput={(e) => setDraft((e.currentTarget as HTMLInputElement).value)}
        />
        <button
          type="button"
          class="ape-options__btn"
          onClick={() => { const k = draft.trim(); if (k) onSave(k); }}
        >
          Save
        </button>
        <button type="button" class="ape-options__btn ape-options__btn--ghost" onClick={onDelete}>
          Delete
        </button>
      </div>
    </section>
  );
}
