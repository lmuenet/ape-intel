# Multi-Broker via Broker Registry — Implementation Plan

> Implements **ADR-0006**. TDD: write failing tests first, then minimal code.

**Goal:** Generalise ISIN detection from Scalable-only to a Broker registry, add
Smartbroker+ as the second Broker, and inject the content script on Smartbroker+
security pages. Audience unchanged (author). No downstream service changes —
everything past ISIN detection is already broker-agnostic.

**Architecture (ADR-0006):**
- `src/lib/isin.ts` exposes a `Broker` interface + a `BROKERS` registry; each
  Broker has an `id`, a host match, and an `extractIsin(url)`.
- `parseIsinFromUrl` consults the registry: first Broker whose host matches owns
  the URL; its extracted candidate is validated with `isValidIsin`.
- Extractors stay strict (host + path structure), no DOM scraping.
- `manifest.config.ts` gains a Smartbroker+ `content_scripts` match.
- `url-observer.ts` unchanged (already host-agnostic).

**URL shapes:**
- Scalable: `de.scalable.capital/broker/security?isin=<ISIN>` (query param)
- Smartbroker+: `app.smartbrokerplus.de/p/<portfolioId>/assets/<ISIN>` (path tail)

---

## Task 1: Broker registry in `isin.ts` (TDD)

**Files:** `src/lib/isin.ts`, `src/lib/isin.test.ts`

- [ ] **Step 1: Extend the failing tests** — keep the existing Scalable cases,
  add Smartbroker+ cases:
  - extracts ISIN from `https://app.smartbrokerplus.de/p/3453166001/assets/US53222K2050`
  - extracts an ETF ISIN `…/assets/IE00B4L5Y983`
  - returns null for a Smartbroker+ non-asset page (`…/p/3453166001/portfolio`)
  - returns null for a Smartbroker+ asset path with a malformed ISIN
  - still returns null for unknown hosts and unparseable URLs
- [ ] **Step 2:** Run `npx vitest run src/lib/isin.test.ts` → FAIL on new cases.
- [ ] **Step 3:** Implement the `Broker` interface + `BROKERS` registry +
  registry-driven `parseIsinFromUrl`. Keep `isValidIsin` unchanged.
- [ ] **Step 4:** Run the test → all pass.
- [ ] **Step 5:** `npm run typecheck` → 0.
- [ ] **Step 6:** Commit `feat(broker): generalise isin detection to a broker registry`.

## Task 2: Manifest — inject on Smartbroker+

**Files:** `manifest.config.ts`

- [ ] **Step 1:** Add a second `content_scripts` match
  `https://app.smartbrokerplus.de/*` (broad host match: SB+ is an SPA with a
  variable `portfolioId` segment, so match the host and let the registry +
  `observeIsin` filter to asset pages — robust to any entry point). Generalise
  the `description` from "Scalable Capital" to "supported broker". Bump version.
- [ ] **Step 2:** `npm run build` → 0, `dist/manifest.json` lists both matches.
- [ ] **Step 3:** Commit `feat(manifest): inject on smartbroker+ security pages`.

## Task 3: Full suite + manual verification

- [ ] **Step 1:** `npm run typecheck && npm test` → all green.
- [ ] **Step 2 (interactive):** Load `dist/manifest.json` in Firefox; open a
  Smartbroker+ asset page → Badge appears with the ISIN; navigate to another
  asset → Badge updates; a non-asset SB+ page → no Badge. Scalable still works.

## Done criteria
- `npm test` + `npm run typecheck` green.
- Registry drives detection for both brokers; adding a third is one entry + one match.
- Badge renders on both Scalable and Smartbroker+ asset pages.
