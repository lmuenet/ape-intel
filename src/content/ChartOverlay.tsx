import { useEffect } from "preact/hooks";

export interface ChartOverlayProps {
  isOpen: boolean;
  ticker: string | null | undefined;
  onClose: () => void;
}

function tradingViewSrc(ticker: string): string {
  const params = new URLSearchParams({
    symbol: ticker,
    interval: "D",
    theme: "dark",
    style: "1",
    locale: "en",
    hideideas: "1",
    withdateranges: "1",
  });
  return `https://s.tradingview.com/widgetembed/?${params.toString()}`;
}

export function ChartOverlay({ isOpen, ticker, onClose }: ChartOverlayProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !ticker) return null;

  return (
    <div
      class="ape-intel-chart"
      role="dialog"
      aria-label={`TradingView chart for ${ticker}`}
      aria-modal="true"
      onClick={onClose}
    >
      <div
        class="ape-intel-chart__inner"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          class="ape-intel-chart__close"
          aria-label="Close chart"
          onClick={onClose}
        >
          ×
        </button>
        <iframe
          class="ape-intel-chart__iframe"
          src={tradingViewSrc(ticker)}
          title={`TradingView chart for ${ticker}`}
          allow="fullscreen"
        />
      </div>
    </div>
  );
}
