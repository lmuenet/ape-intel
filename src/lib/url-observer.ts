import { parseIsinFromUrl } from "./isin";

export type IsinListener = (isin: string | null) => void;

const DEFAULT_INTERVAL_MS = 250;

export function observeIsin(
  win: Window,
  onChange: IsinListener,
  intervalMs: number = DEFAULT_INTERVAL_MS,
): () => void {
  let lastUrl = win.location.href;
  let lastIsin = parseIsinFromUrl(lastUrl);

  const check = (): void => {
    const url = win.location.href;
    if (url === lastUrl) return;
    lastUrl = url;
    const isin = parseIsinFromUrl(url);
    if (isin === lastIsin) return;
    lastIsin = isin;
    onChange(isin);
  };

  const popstateHandler = (): void => check();
  win.addEventListener("popstate", popstateHandler);
  const intervalId = win.setInterval(check, intervalMs);

  onChange(lastIsin);

  return () => {
    win.clearInterval(intervalId);
    win.removeEventListener("popstate", popstateHandler);
  };
}
