import { useEffect, useState } from "preact/hooks";

export interface PromptSectionProps {
  value: string;
  isCustom: boolean;
  onSave: (text: string) => void;
  onReset: () => void;
}

export function PromptSection({ value, isCustom, onSave, onReset }: PromptSectionProps) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  return (
    <section class="ape-options__section">
      <h2 class="ape-options__title">AI export prompt</h2>
      <p class="ape-options__hint">
        The base instruction prepended to the briefing on copy.{" "}
        <span>{isCustom ? "Customised." : "Using the default."}</span> The risk/horizon trading profile is
        set per export in the Side Panel, not here.
      </p>
      <textarea
        class="ape-options__textarea"
        aria-label="Export prompt"
        rows={16}
        value={draft}
        onInput={(e) => setDraft((e.currentTarget as HTMLTextAreaElement).value)}
      />
      <div class="ape-options__row">
        <button type="button" class="ape-options__btn" onClick={() => onSave(draft)}>Save</button>
        <button type="button" class="ape-options__btn ape-options__btn--ghost" onClick={onReset}>
          Reset to default
        </button>
      </div>
    </section>
  );
}
