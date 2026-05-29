# Daily Trading Loop — Vision (post-v1)

> **Status: Vision / parking-lot. NOT binding for v1.**
> This describes a post-MVP direction, to be implemented *externally* once the
> Ape Intel extension MVP is complete. The binding v1 spec is `docs/PRD.md` and
> the ADRs in `docs/adr/`. If this doc and the PRD/ADRs disagree about v1, the
> PRD/ADRs win. Nothing here changes the v1 scope — it only records intent and
> the data foundations v1 should leave in place so the external routine is easy
> to build later.

Date: 2026-05-29

---

## 1. The idea

A pair of scheduled **Claude Code routines** (cron / `/schedule`), living
*outside* the browser extension, that turn the extension's collected data into
a daily trading workflow:

1. **Morning Call** (before market open) — a market-wide scan surfacing the
   hottest plays of the day and what to watch.
2. **Evening Review** (after market close) — asks which plays were actually
   made, logs them to a trade journal, and analyses them in retrospect to
   sharpen strategy over time.

The extension stays what it already is: a **data collector / frontend**. The
routines are the **analyst** on top of that data. This keeps the extension's
non-goals intact (no backend, no push notifications *inside the extension*) —
the scheduling, synthesis and journaling all happen in the external Claude
routine.

## 2. Why external (and not in the extension)

- The extension's binding non-goals (PRD §2) forbid a backend and push
  notifications. A cron-driven analyst that runs on the user's machine and
  reads the extension's exported data respects that boundary.
- Claude Code already provides the scheduling primitive (`/schedule` / cron),
  so the routine is "just" a structured prompt + the extension's data sources.
- The Briefing/Export surface (ADR-0002) already exists as a sanctioned way to
  get structured data out of the extension and into an LLM.

## 3. Architecture (data flow)

```
   ┌─────────────────────────────┐
   │  Ape Intel extension (v1)   │   collector / frontend
   │  - sentiment (3 sources)    │
   │  - catalyst-grade news      │
   │  - earnings calendar        │
   │  - trending overview        │
   │  - favourites + snapshots   │
   └──────────────┬──────────────┘
                  │ exports a structured daily snapshot
                  │ (JSON / Markdown Briefing) the routine can read
                  ▼
   ┌─────────────────────────────┐
   │  Daily Trading Loop (extern)│   analyst (Claude Code, cron)
   │                             │
   │  AM:  Morning Call ──────────────► "today's plays + watch list"
   │  PM:  Evening Review ◄───────────  "which plays did you make?"
   │        └─► Trade Journal ──► retrospective analysis ──► strategy tuning
   └─────────────────────────────┘
```

The routine consumes the extension's sources in a **structured** way inside the
cron — it does not re-scrape the upstream APIs itself if the extension can hand
it a clean snapshot.

## 4. Morning Call

- **Goal:** market-wide discovery of the day's hottest plays, plus a focused
  watch list.
- **Inputs:**
  - Trending sentiment across **Apewisdom + Tradestie + StockTwits**
    (Tradestie reactivated — see §6).
  - **Catalyst-grade news** — not just a Top-5 display, but structured,
    scannable catalysts (earnings, guidance, M&A, FDA/regulatory, etc.).
  - Earnings happening *today*.
- **Output:** a short briefing — the plays worth attention today and *why*,
  ranked, with the signals that drove each pick.

## 5. Evening Review

- **Goal:** close the loop and build a long-term strategy feedback signal.
- **Flow:**
  1. Prompts the user: *which plays did you make today?*
  2. Appends them to a **Trade Journal** (persistent log).
  3. Analyses outcomes in retrospect — what worked, what didn't, how it
     compared to the morning call's picks.
  4. Over days/weeks, surfaces patterns to refine the trading strategy.

## 6. Data foundations v1 / v1.x should leave in place

These are the prerequisites that make the external routine easy to build. They
are recorded here as forward pressure on the extension roadmap — *not* as new
binding v1 requirements unless promoted into the PRD/a plan explicitly.

- **Catalyst-grade News** — the news section grows from "Top 5 display" toward
  structured, scannable catalysts the routine can reason over.
- **Trending overview + Tradestie reactivation** — promoted from "nice to have"
  to the data foundation of the Morning Call's market-wide scan.
- **Structured daily snapshot / export** — a clean, machine-readable artefact
  (JSON and/or the existing Markdown Briefing) the cron routine can ingest.
- **Trade Journal storage** — a persistent place for executed plays + review
  notes. Likely owned by the routine, not the extension.

## 7. Open questions (defer until post-MVP)

- **Trigger mechanics:** how the routine fires (Claude Code `/schedule`, OS
  cron, etc.) and how AM/PM timing is configured.
- **Hand-off:** how the routine actually reads the extension's data — exported
  file the extension writes, manual copy of the Briefing, or a local read of
  `storage.local`. Cleanest is probably a file the extension can export on
  demand / on a daily snapshot.
- **Journal storage:** format and location of the trade journal (flat Markdown,
  JSON, SQLite?), and whether the extension ever displays it.
- **Scope creep guard:** keep the routine read-only against the broker — no
  execution, consistent with the extension's non-goals.
```
