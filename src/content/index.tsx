import { render } from "preact";
import { Badge } from "./Badge";
import { observeIsin } from "../lib/url-observer";

const HOST_ID = "ape-intel-host";

function ensureHost(): HTMLElement {
  const existing = document.getElementById(HOST_ID);
  if (existing) return existing;
  const host = document.createElement("div");
  host.id = HOST_ID;
  document.body.appendChild(host);
  return host;
}

observeIsin(window, (isin) => {
  if (isin) {
    render(<Badge isin={isin} />, ensureHost());
  } else {
    const host = document.getElementById(HOST_ID);
    if (host) render(null, host);
  }
});
