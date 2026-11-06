---
name: remaking-play-hits
description: Use when choosing or adapting a Google Play hit for Yandex Games — finding a proven game, reverse-engineering its formula, rewriting it as an original build, and comparing it with the Yandex top. Triggers: "сделай как <игра>", "порти хит", "клон", "реверс игры", "найди популярную игру в Google Play", "сравни с топом", "что выпустить дальше".
---

# Remaking Play hits for Yandex Games

**Core principle: steal the loop, never the look.** Genre, mechanics, pacing, camera type and
monetization structure are fair game. Names, logos, characters, art, music, text and trade dress
are not: Yandex rejects 1:1 reskins (requirement 3.6) and copying protected assets is a legal
risk. A remake ships only when it is recognisably its own game with a proven loop underneath.

If the user says "скопируй игру X" — confirm the intent, then say plainly: we take the proven
formula, not the assets, because a reskin gets rejected and is a worse product. Then run the
pipeline; do not argue, do not silently produce a clone.

## When to use

- The user names a Play game ("сделай как X") or asks to port/clone a hit.
- You need the next title and must choose from live demand, not memory.
- You want a concept compared with the Yandex top before spending build time.

**Do not use** for a purely original concept with no source game (use `game-studio` directly),
or for polishing an existing build (use `verification-loop`).

## Pipeline — each stage ends with an artifact

| # | Stage | Artifact | Gate |
|---|---|---|---|
| 0 | Target: a URL/package from the user, or a live chart scan | `market/play-<slug>-YYYY-MM.md` | Chosen from a dated source, never from memory |
| 1 | Live research: Play page, charts, reviews, similar apps | same file, sources + numbers | Rating, installs band, 3+ screenshot URLs, review themes |
| 2 | DNA card: what the game actually is | `games/<slug>/PLAY-DNA.md` | Every field filled, "why it works" in one sentence |
| 3 | Legal filter: what we may and may not carry | `games/<slug>/ORIGINALITY.md` | Distance statement + similarity check pass |
| 4 | Yandex top comparison and go/no-go | `market/scan-YYYY-MM.md` + scoring block | Score ≥ threshold; a named gap vs the top |
| 5 | Contract: choice and spec | `games/<slug>/CHOICE.md`, `SPEC.md` | Spec covers loop, meta, ads, limits |
| 6 | Build, media, package | `games/<slug>/`, `packages/<slug>/` | `game-studio` order; capture + montage |
| 7 | Gates and independent score | CHECKLIST + report | smoke, audit, testbed, release-check, RUBRIC ≥85 |

### 0–1. Research (never from memory)

Start with a live source and escalate until something real loads. In this factory's network
`play.google.com` and AppBrain often reset (`ERR_CONNECTION_RESET`) and `WebSearch` can return
empty — that is a blocked path, not "no such game".

| Route | Command | When |
|---|---|---|
| WebSearch | `web_search_fast` with the title + developer | always first; one or two queries |
| WebFetch + Bing | follow `web-research` | WebSearch empty, page domains allowed |
| Direct Play snapshot | `node scripts/play-scout.mjs <packageId или "Название">` | Play reachable |
| Visible Chrome | `cd pipeline && node browse.mjs "<play-url>" play-<slug>` | Play/AppBrain blocked; the human passes the captcha, the script saves `scratch/play-<slug>.json` (text + links) |
| User's link/screenshot | ask for the Play URL | nothing else works |

`play-scout` writes `market/play-<slug>.md`: title, developer, rating, installs, genre,
screenshots, similar packages, text extract. When Play is blocked it falls back to Bing and
**refuses irrelevant snippets** — if it reports FAIL, use the visible-Chrome route; do not
substitute memory. Treat every number as a dated snapshot, not eternal truth.

Record: rating and review count, installs band, price/IAP signals, chart position if visible,
3–6 screenshot URLs, recurring review praises/complaints, 3–6 similar games, and the promise
the store page makes in one line.

### 2. DNA card

Fill `references/dna-card.md` **before** designing anything. The card forces the split between
what made the game work and what merely decorates it: core loop verbs and their order, session
length, controls, camera, UI zones, difficulty curve, progression, meta, monetization, art
direction (palette family, shapes, mood — not assets), audio role, retention hooks, audience.
Finish with: "why it works in one sentence" and "what to keep / what to throw away".

### 3. Legal filter — hard gate

Read `references/legal-filter.md` and produce `ORIGINALITY.md`:

- **Keep:** mechanics and rules, genre conventions, generic UI patterns (a shop is a shop),
  camera type, pacing, monetization structure, a mood/palette *family*.
- **Drop:** name, logo, characters, sprites/models, level layouts, text, music/sfx files, fonts
  without a licence, icon silhouette, trade dress (distinctive frame + palette + type combo).
- **Distance statement:** one sentence naming the new theme, the new core verb or twist, and
  why a player cannot mistake it for the source.
- **Similarity check:** compare our icon, title, first screen and loop summary with the source
  and with the Yandex top three. If the silhouette or name reads as the same product, change
  the theme or the verb — not the spelling.

No `ORIGINALITY.md` → no build. A 1:1 reskin is a failed gate, not a fast win.

### 4. Compare with the Yandex top

Live-scan `https://yandex.ru/games/` and `/category/new` (WebFetch; record date, top scores
88–99, genres, what is rising). Then fill the positioning table in
`references/scoring.md`: top-3 in the genre, their score, their hook, our gap, and a weighted
go/no-go score (demand, competition, feasibility, uniqueness, monetization). Below threshold →
pick another target; do not "build and see".

### 5. Contract and build

Write `CHOICE.md` (genre, theme, three confirmations from the top, one-sentence difference,
icon legibility at 128×128) and `SPEC.md` (loop, score, loss, meta, ads, limits). Then run
`game-studio`: engine 1:1 from `games/parkingescape`, `index.html` + `game/*.js`, media via the
`capture-<slug>.mjs` template, montage. Engine contract: `factory-engine`. Platform rules and
package layout: `yandex-games`.

### 6. Gates and score

`smoke` → `audit` (0 issues) → `testbed` (48/48) → `release-check` (0) → independent `RUBRIC`
(≥85). A red gate means the game is not ready, regardless of how it looks. Package, fill
`CHECKLIST.md`, then only the console upload remains manual.

## Orchestration map

| Need | Skill |
|---|---|
| Research, broken WebSearch, Play pages | `web-research` + `scripts/play-scout.mjs` |
| Concept, spec, pipeline, gates | `game-studio` |
| Engine, capture contract, i18n | `factory-engine` |
| Platform rules, texts, media limits | `yandex-games` |
| Genre mechanics | `puzzle`, `card-game`, `arena` |
| 3D / Godot | `godot-web-game`, `blender-3d-studio` |
| Media, promos, video | `media-use` |
| Logic-first correctness | `tdd-workflow` |
| Review and done-check | `verification-loop`, `coding-standards`, `security-review` |

## Red flags — stop and fix

- The target was picked from memory or "I know this game".
- Numbers (rating, installs, chart) have no source and date.
- A design starts before the DNA card and the originality statement exist.
- The new title/icon/screenshot could be mistaken for the source.
- "We'll compare with the top later."
- Build starts before the go/no-go score clears the threshold.
- "The gates can wait until it looks good."

## Rationalisations

| Excuse | Reality |
|---|---|
| "Mechanics aren't copyrightable, so a reskin is fine" | Yandex 3.6 rejects look-alikes; the legal filter is about trade dress, not just code. |
| "I already know the game" | Memory drifts; charts change. Verify or label as unverified. |
| "The top is all match-3, we're different" | Different genre is not a gap unless the top scan says so. |
| "We'll check similarity at the end" | A similarity failure after build is a rewrite; it is a stage-3 gate. |
| "More features = better" | Scope without a spec contract is how builds miss gates. |

## References

- `references/dna-card.md` — fill-in template.
- `references/legal-filter.md` — allowed/forbidden, distance statement, similarity checklist.
- `references/scoring.md` — Yandex top table + weighted go/no-go.
- `scripts/play-scout.mjs` — headless Play page snapshot.
