import { render } from "preact";
import { Badge } from "./Badge";
import { parseIsinFromUrl } from "../lib/isin";

const HOST_ID = "ape-intel-host";

function mount(isin: string): void {
  if (document.getElementById(HOST_ID)) return;
  const host = document.createElement("div");
  host.id = HOST_ID;
  document.body.appendChild(host);
  render(<Badge isin={isin} />, host);
}

const isin = parseIsinFromUrl(location.href);
if (isin) mount(isin);
