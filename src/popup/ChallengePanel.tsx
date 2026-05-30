import type { StoredTrendingChallenge } from "../lib/trending-challenge";

export interface ChallengePanelProps {
  copyState: "idle" | "copied" | "error";
  onCopy: () => void;
  challenge: StoredTrendingChallenge | null;
  stale: boolean;
  parseError: boolean;
  onApply: (text: string) => void;
  onClear: () => void;
}

const COPY_LABEL: Record<ChallengePanelProps["copyState"], string> = {
  idle: "Copy Challenge prompt",
  copied: "Copied ✓",
  error: "Copy failed",
};

export function ChallengePanel(props: ChallengePanelProps) {
  const onApplySubmit = (e: Event) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const textarea = form.elements.namedItem("challenge") as HTMLTextAreaElement | null;
    const value = textarea?.value.trim() ?? "";
    if (value) props.onApply(value);
  };

  return (
    <div class="ape-challenge">
      <button type="button" class="ape-challenge__copy" onClick={props.onCopy}>
        {COPY_LABEL[props.copyState]}
      </button>

      <form class="ape-challenge__form" onSubmit={onApplySubmit}>
        <textarea
          name="challenge"
          class="ape-challenge__textarea"
          aria-label="Paste the Challenge JSON"
          placeholder="Paste the LLM's JSON answer here…"
          rows={3}
        />
        <button type="submit" class="ape-challenge__apply">Apply</button>
      </form>

      {props.parseError ? (
        <p class="ape-popup__hint ape-popup__hint--error">Couldn’t read that — paste the JSON the prompt asked for.</p>
      ) : null}

      {props.challenge ? (
        <div class="ape-challenge__result">
          {props.challenge.summary ? <p class="ape-challenge__summary">{props.challenge.summary}</p> : null}
          <p class="ape-challenge__meta">
            Challenge as of {new Date(props.challenge.ingestedAt).toLocaleString()}
            {" · "}
            <button type="button" class="ape-challenge__clear" onClick={props.onClear}>clear</button>
          </p>
          {props.stale ? (
            <p class="ape-popup__hint">Board updated since this Challenge — re-run it for fresh verdicts.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
