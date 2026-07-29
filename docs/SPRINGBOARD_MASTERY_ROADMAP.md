# Springboard → KS3–GCSE Mastery Roadmap

Goal: springboard.html is a **complete, interactive, start-to-finish guide** from KS3 to GCSE.
Target: **180–250 hours** on the standard route (~500 h with full retrieval/review), with a real
build-up to **6-mark extended answers**. This doc is the working plan for the improvement loop;
update the checklist as iterations land.

## Deep-dive findings (2026-07-02)

**Runtime** (springboard.html, ~2,600 lines)
- Flow per unit: Learn/Build/Practise/Apply lessons → facts (teach cards + build-up diagram
  reveals) → vocab (etymology, hear/say) → question loop (8 types) → match/listen-type
  consolidation. Sequential track gating (KS3, GCSE Phy/Chem/Bio), recaps, 5-box spaced
  review [1,2,4,9,20] days, weak-spot sessions, hearts, XP.
- 103 SVG diagrams in `DIAGRAMS` registry with `data-part` reveal gating + `sm-*` motion.
- 17 canvas "explore" widgets (`INTERACTIVES`) on topic intros only.

**Content** (content.js — 141 units, 1,314 questions, 691 facts)
- mcq 647 · tf 190 · numeric 181 · categorise 87 · multi 86 · exam 66 · order 49 · diagram 28.
- **Standard route ≈ 28–40 h today → 84% short of the 180 h floor.**
- 110/141 units have **zero** exam-type questions (incl. every KS3 core unit).
- 0/647 MCQs have per-option explanations (only a generic `ok` line).
- 25 `-EX` units are bare question banks (0 facts/vocab/diagrams).
- 32 units have <5 facts; 31 units have no diagram.

## Done

- [x] **Diagram checkpoints (`dcheck`)** — every fact that adds a diagram part is now followed
  by a "tap the ___ (labels hidden)" retrieval step, auto-generated from the diagram map.
  413 checkpoints across 110 units. (2026-07-02)
- [x] **Guided exam builder** — exam steps now coach the command word (explain/describe/
  compare/evaluate…), take a typed answer in-app, pre-tick mark-scheme points found in the
  answer, let the pupil self-mark point-by-point for a real score /marks (stored as
  `got/total` in `State.s.exam`), then show the model answer. (2026-07-02)

## Iteration queue (one bite per loop pass; keep each shippable)

1. **6-mark ladder for KS3** — add a graded `exam` set to every KS3 core unit (34 units):
   one 2-mark "describe", one 4-mark "explain", one 6-mark synthesis per unit, each with
   `scheme` (1 point per mark) + `model`. Author in house style (because/so links, command
   words). ~100 questions; multi-agent authoring like the retrieval-bank run.
2. **MCQ `why` explanations** — add per-option `why` (why right, why each distractor is the
   misconception) to MCQs, batch of ~10 units per iteration, starting with Y7 (P1, C1, B1, C2…).
   Wire renderer to show the picked option's `why` on wrong answers (it already prefers `.why`).
3. **Fatten the `-EX` units** into real "exam technique" units: teach WHAT the command words
   demand, PEEL-style answer structure, then 2→4→6-mark ladder per topic block.
4. **Thin-unit expansion** — bring the 32 units with <5 facts up to 10–15 facts each, with
   diagram `map` coverage so the build-up + dcheck pipeline applies.
5. **More diagram questions** — target ~150 `diagram` hotspot questions (currently 28); every
   unit with a DIAGRAMS entry should quiz it in the question loop, not just at teach time.
6. **Required-practical 6-markers** — plan/analyse/improve triplets for the AQA required
   practicals (density, SHC, electrolysis, chromatography, osmosis, photosynthesis rate…).
7. **Numeric depth** — chemistry moles/concentration and biology rates/percentages ladders
   (currently physics-heavy; 181 → ~280 numeric).
8. **More explore widgets** — extend `INTERACTIVES`/`TOPIC_IX` beyond 17 topics (mo