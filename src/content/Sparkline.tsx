import { sparklinePoints } from "../lib/sparkline";
import type { DailySnapshot } from "../lib/snapshot-history";

const SPARK_W = 120;
const SPARK_H = 28;

export interface SparklineSectionProps {
  history: DailySnapshot[] | null | undefined;
}

export function Sparkline({ values }: { values: number[] }) {
  return (
    <svg
      class="ape-intel-spark__svg"
      width={SPARK_W}
      height={SPARK_H}
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      role="img"
      aria-label="7-day mentions trend"
    >
      <polyline class="ape-intel-spark__line" fill="none" points={sparklinePoints(values, SPARK_W, SPARK_H)} />
    </svg>
  );
}

export function SparklineSection({ history }: SparklineSectionProps) {
  return (
    <section class="ape-intel-panel__source ape-intel-spark">
      <h3 class="ape-intel-panel__section-title">7-day momentum</h3>
      {history === undefined ? <p class="ape-intel-panel__placeholder">Loading…</p>
      : history === null ? <p class="ape-intel-panel__placeholder">Couldn't load momentum.</p>
      : history.length < 2 ? <p class="ape-intel-panel__placeholder">Collecting data ({history.length}/7)…</p>
      : (
        <div class="ape-intel-spark__body">
          <Sparkline values={history.map((d) => d.mentions)} />
          <span class="ape-intel-spark__current">{history[history.length - 1].mentions} mentions</span>
        </div>
      )}
    </section>
  );
}
