# CLAUDE.md

Single-file MTG Jumpstart randomizer. Picks two random thematic packs from the JMP 2020 set, shows the combined 40-card deck with mana symbols sorted by cmc, and exports as Moxfield-importable text for Tabletop Simulator deck loading.

## architecture

Everything in `index.html` (no build step, no deps). Inside `<script>`, top to bottom:

- `CONFIG` — animation timings, copy toast duration
- `RAW_MARKDOWN` — 121 pack decklists as a markdown literal, parsed at startup into `PACKS[]`
- `JMP_BASICS` + `CARD_DATA` — local lookup: `name → [set, cn, mana_cost, cmc]`
- `exportCard(name)` — single resolution point for set/cn/cost lookup; modify only this function body to change the data source
- `parseMarkdown()` — markdown → `PACKS[]`
- `FX` class — particle canvas + ambient tint cross-fade per pack color
- state → roll → animate → render → events → hover preview

`scripts/validate-data.mjs` — runs all data invariants. Exit 0 = healthy.

## rules

- Never break single-file portability: no build step, no npm deps, no external JS. CSS-from-CDN is allowed (currently Google Fonts + mana-font).
- After touching `RAW_MARKDOWN` or `CARD_DATA`, run `node scripts/validate-data.mjs`; expect 0 critical problems.
- Do not autonomously start servers, navigate browsers, or take screenshots to verify UI changes. After UI/CSS work, summarize what to check and ask the user to confirm visually or to share a screenshot.
- The combined reveal stage must fit in a 1080-height viewport without scroll. When proposing layout changes, call out which worst cases the user should verify: two-line pack names (heavily armored, above the clouds, feathered friends) and high-unique-count combos (rainbow + anything → 33 unique cards).
- Every exported card line must carry `(SET) cn`. Zero fallback "no-set" lines.

## conventions

- Comments explain WHY only, never WHAT. Lowercase, terse.
- Spanish UI strings, English identifiers.
- JMP set preferred; M21 only when no JMP printing exists.
