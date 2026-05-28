import { parseIsinFromUrl } from "./isin";

export type IsinListener = (isin: string | null) => void;

const LOCATION_CHANGE_EVENT = "ape-intel:locationchange";

export function observeIsin(win: Window, onChange: IsinListener): () => void {
  let lastUrl = win.location.href;
  let lastIsin = parseIsinFromUrl(lastUrl);

  const originalPush = win.history.pushState;
  const originalReplace = win.history.replaceState;

  const wrap = (
    fn: typeof originalPush,
  ): typeof originalPush =>
    function patched(this: History, ...args) {
      const result = fn.apply(this, args);
      win.dispatchEvent(new Event(LOCATION_CHANGE_EVENT));
      return result;
    } as typeof originalPush;

  win.history.pushState = wrap(originalPush);
  win.history.replaceState = wrap(originalReplace);

  const handler = (): void => {
    const url = win.location.href;
    if (url === lastUrl) return;
    lastUrl = url;
    const isin = parseIsinFromUrl(url);
    if (isin === lastIsin) return;
    lastIsin = isin;
    onChange(isin);
  };

  win.addEventListener("popstate", handler);
  win.addEventListener(LOCATION_CHANGE_EVENT, handler);

  onChange(lastIsin);

  return () => {
    win.history.pushState = originalPush;
    win.history.replaceState = originalReplace;
    win.removeEventListener("popstate", handler);
    win.removeEventListener(LOCATION_CHANGE_EVENT, handler);
  };
}
