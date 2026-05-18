# CLAUDE.md

Single-file MTG Jumpstart randomizer. User picks one or more Jumpstart sets (JMP 2020, J22 2022, J25 Foundations 2024), tirá ROLL, get two random thematic packs from the active union, see the combined 40-card deck with mana symbols sorted by cmc, export as Moxfield-importable text for Tabletop Simulator deck loading.

## architecture

Everything in `index.html` (no build step, no deps). Inside `<script>`, top to bottom:

- `CONFIG` — animation timings, copy toast duration
- `RAW_MARKDOWN_JMP` / `CARD_DATA_JMP` / `JMP_BASICS_JMP` / `CREATURE_NAMES_JMP` / `PACK_EMBLEM_JMP` / `PACK_RARITY_JMP` / `THEME_DESCRIPTIONS_JMP` — JMP 2020 literals
- `resolveCard(name, setCode)` — single resolution point for set/cn/cost/isCreature lookup; modify only this function body to change the data source
- `parseMarkdown(md, setCode)` — markdown → packs[] with `set`, `theme`, `color`, `rarity`, `description`, `emblemCard`, and resolved cards (each card carries `{qty,name,set,cn,mc,cmc,isCreature}`)
- `FX` class — particle canvas + ambient tint cross-fade per pack color
- state → roll → animate → render → events → hover preview
- `SETS = { JMP, J22, J25 }` — multi-product data (J22/J25 inlined; JMP snapshotted from the literals above). `loadProducts(codes)` rebuilds `PACKS` as the union of the selected products' packs.
- `preloadEmblem(pack)` — fires inside `animateRoll`, in parallel with the reel, for the two packs that actually land. No upfront warm-up.

`scripts/validate-data.mjs` — runs all data invariants for the three products. Exit 0 = healthy.

## rules

- Never break single-file portability: no build step, no npm deps, no external JS. CSS-from-CDN is allowed (currently Google Fonts + mana-font).
- After touching any `*_JMP` literal or a J22/J25 block inside `SETS`, run `node scripts/validate-data.mjs`; expect 0 critical problems across all three products.
- Do not autonomously start servers, navigate browsers, or take screenshots to verify UI changes. After UI/CSS work, summarize what to check and ask the user to confirm visually or to share a screenshot.
- The combined reveal stage must fit in a 1080-height viewport without scroll. When proposing layout changes, call out which worst cases the user should verify: two-line pack names (JMP heavily armored / above the clouds / feathered friends; J22 think again / go to school / multi-headed; J25 grave robbers / ne'er-do-wells / of the coast) and high-unique-count combos (JMP rainbow + anything → ~33 unique; J22 urza's + anything; J25 chaos + anything).
- Every exported card line must carry `(SET) cn`. Zero fallback "no-set" lines.
- Multi-set rolls mix cross-set packs freely: a JMP pack and a J22 pack are a valid pair. Duplicate cards across sets (Plains, etc.) group by name on the combined view; the export emits the first occurrence's `(SET) cn`.

## conventions

- Comments explain WHY only, never WHAT. Lowercase, terse.
- Spanish UI strings, English identifiers.
- JMP 2020 cards use set `JMP` (M21 when no JMP printing exists). J22 and J25 cards use their own set code throughout.
- `state.activeSets` (Array of `'JMP'|'J22'|'J25'`) is persisted in `localStorage.jumpstart_sets`. Selection chips toggle min 1, max 3.
- Emblems load on-demand inside `animateRoll` for the two final picks only. The mosaic relies on `<img loading="lazy">` and the browser's HTTP cache; no eager fetcher.
