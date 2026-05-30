import type { StoredStrategy } from "../lib/strategy";

export interface StrategySectionProps {
  strategy: StoredStrategy | null | undefined;
  parseError: boolean;
  onSaveStrategy: (raw: string) => void;
  onClearStrategy: () => void;
}

function ingestedLabel(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
}

function directionKind(direction: string): "long" | "short" | "stay-out" {
  const d = direction.toLowerCase();
  if (d.includes("short")) return "short";
  if (d.includes("long")) return "long";
  return "stay-out";
}

function StrategyForm({ parseError, onSaveStrategy }: { parseError: boolean; onSaveStrategy: (raw: string) => void }) {
  const onSubmit = (e: Event) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const ta = form.elements.namedItem("strategyText") as HTMLTextAreaElement | null;
    const value = ta?.value.trim() ?? "";
    if (value) onSaveStrategy(value);
  };
  return (
    <form class="ape-intel-strategy__form" onSubmit={onSubmit}>
      <textarea
        name="strategyText"
        class="ape-intel-strategy__input"
        rows={4}
        placeholder="Paste the AI's full answer here"
      />
      <button type="submit" class="ape-intel-strategy__save">Save strategy</button>
      {parseError ? <p class="ape-intel-panel__placeholder">Couldn't read a strategy from that text.</p> : null}
    </form>
  );
}

function Field({ label, value }: { label: string; value: string | undefined }) {
  if (!value) return null;
  return (
    <div class="ape-intel-strategy__field">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function StrategySection({ strategy, parseError, onSaveStrategy, onClearStrategy }: StrategySectionProps) {
  return (
    <section class="ape-intel-panel__source ape-intel-strategy">
      <h3 class="ape-intel-panel__section-title">AI Strategy</h3>
      {strategy === undefined ? <p class="ape-intel-panel__placeholder">Loading…</p>
      : !strategy ? <StrategyForm parseError={parseError} onSaveStrategy={onSaveStrategy} />
      : (
        <div class="ape-intel-strategy__view">
          {strategy.direction ? (
            <span class="ape-intel-strategy__direction" data-direction={directionKind(strategy.direction)}>
              {strategy.direction}
            </span>
          ) : null}
          <dl class="ape-intel-strategy__fields">
            <Field label="Timeframe" value={strategy.timeframe} />
            <Field label="Target" value={strategy.targetPrice} />
            <Field label="Stop" value={strategy.stopLoss} />
            <Field label="Leverage" value={strategy.leverage} />
            <Field label="Instruments" value={strategy.instruments} />
            <Field label="Position sizing" value={strategy.positionSizing} />
            <Field label="Barometer critique" value={strategy.barometerCritique} />
            <Field label="Rationale" value={strategy.rationale} />
            <Field label="Risks" value={strategy.risks} />
          </dl>
          <div class="ape-intel-strategy__footer">
            <span class="ape-intel-strategy__ingested">Ingested {ingestedLabel(strategy.ingestedAt)}</span>
            <button type="button" class="ape-intel-strategy__clear" onClick={onClearStrategy}>Clear</button>
          </div>
        </div>
      )}
    </section>
  );
}
