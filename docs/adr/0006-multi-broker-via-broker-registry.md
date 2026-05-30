# ADR-0006: Multi-broker support via a Broker registry

Status: Accepted
Date: 2026-05-30
Relaxes: PRD §2 non-goal "other brokers"

## Context

The extension shipped Scalable-Capital-only. PRD §2 listed "other brokers" as an
explicit non-goal. That non-goal is now relaxed: the author trades on more than
one broker (Smartbroker+ in addition to Scalable) and wants the same intel on
both. The audience is unchanged — still a single user (the author), not a
distributable product. So this is about covering the author's own brokers, not a
strategy/market shift.

The broker coupling turned out to be very thin. Everything downstream of ISIN
detection — the background services, Barometer, Briefing, Badge, Side Panel — is
already broker-agnostic; it operates on **ISIN** and **US-Ticker**, never on
Scalable. The Scalable specifics live in essentially one place: how the ISIN is
read from the page.

Crucially, both brokers expose the ISIN **in the URL**, so no DOM scraping is
needed — only the URL shapes differ:

- Scalable: query param — `de.scalable.capital/broker/security?isin=US0378331005`
- Smartbroker+: last path segment —
  `app.smartbrokerplus.de/p/<portfolioId>/assets/US53222K2050`

`parseIsinFromUrl` (`src/lib/isin.ts`) is currently hard-wired to Scalable's
host + path + query param. It must be generalised, and the *shape* of that
generalisation is the decision here, because more brokers are expected over time.

## Decision

Introduce a **Broker registry**: a list of Broker descriptors, each with an `id`,
a host/URL match, and an `extractIsin(url)` function. ISIN detection iterates the
registry and returns the first match's extracted, validated ISIN. Adding a Broker
is then **one registry entry + one `content_scripts` match** in the manifest.

- `src/lib/isin.ts` keeps `isValidIsin` and gains a generic
  `parseIsinFromUrl(url)` that consults the registry instead of hard-coded
  Scalable constants.
- Each extractor stays **strict** (matches the broker's specific host + path
  structure, then validates with `isValidIsin`) rather than "grab any
  ISIN-shaped token anywhere", to avoid false positives on unrelated pages.
- `manifest.config.ts` gains a `content_scripts` match for
  `https://app.smartbrokerplus.de/*` (the security-page path is narrowed by the
  registry extractor at runtime).
- `url-observer.ts` is unchanged: it already watches `location.href` generically
  via polling + `popstate`, which works for any SPA broker.
- "Broker" becomes a domain term (see `CONTEXT.md`).

A broker that hid the ISIN from its URL would need a different, broker-specific
extractor (DOM scraping) and is explicitly **out of scope** until one we care
about actually does that.

## Consequences

**Positive**

- New brokers are cheap and isolated: one descriptor, one manifest match, no
  changes to any downstream service.
- The "central plumbing problem" (ISIN extraction) is now the *only* per-broker
  surface, made explicit in one registry.
- No DOM-scraping fragility while brokers keep the ISIN in the URL.

**Negative**

- The "Scalable-only" simplicity in the docs is gone; PRD/README must speak of
  "a supported Broker", not Scalable, or they drift.
- The registry is an abstraction carried for (currently) two brokers — justified
  only by the expectation of more. If no third broker ever appears, an inline
  branch would have sufficed.
- Broker deep-linking remains one-directional and user-specific (Smartbroker+
  URLs embed the user's `portfolioId`); this constrains the Trending Board
  (ADR-0007).

## Alternatives Considered

- **Minimal inline branch** in `parseIsinFromUrl` for Smartbroker+. Fastest for
  exactly two brokers, but degrades as the third/fourth arrive — and the owner
  explicitly expects "ever more brokers".
- **Per-broker module** with its own extractor + tests each. More power than
  needed while every broker yields the ISIN trivially from the URL; revisit if a
  broker ever forces DOM scraping.
