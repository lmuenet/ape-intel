const ISIN_PATTERN = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;
const SCALABLE_HOST = "de.scalable.capital";
const SCALABLE_PATH = "/broker/security";

export function isValidIsin(value: unknown): value is string {
  return typeof value === "string" && ISIN_PATTERN.test(value);
}

export function parseIsinFromUrl(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.hostname !== SCALABLE_HOST) return null;
  if (url.pathname !== SCALABLE_PATH) return null;
  const candidate = url.searchParams.get("isin");
  return isValidIsin(candidate) ? candidate : null;
}
