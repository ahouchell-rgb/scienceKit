// Houchell Education — one-click AI lesson generator (strategy #11, the teacher wedge).
// POST /api/lesson-generator   Authorization: Bearer <teacher JWT>
//
// Body: { unitId, lessonId?, focus?, lessonType? }
//   lessonType: "terminology" (default) | "maths" | "practical" | "misconception"
//               | "extended-writing" — selects the HOUSE LESSON ENGINE flex, or the
//               Extended-Writing 6-marker skill-builder deck.
// Returns: { deckId, title, slideCount, summary }
//
// Builds a full, ready-to-teach deck from a curriculum unit by REUSING the proven
// slides-assistant generator (same Opus tool-call path, house lesson engine, font
// restore) — in TWO passes, because the full engine (question AND answer slides,
// Independent Practice Core + Stretch, exit check) is ~18–24 slides: pass 1 builds
// the teaching spine, pass 2 EXTENDS the deck with the practice/close beats. Each
// pass stays comfortably inside the model's output window; if pass 2 fails the
// pass-1 deck still saves (the summary says so). Persists a `decks` row owned by
// the teacher and returns its id so the client opens it in the editor.
//
// Env: ANTHROPIC_API_KEY + SUPABASE_SERVICE_ROLE_KEY (consumed by slides-assistant).

import { supaRest } from "@/lib/supabaseRest";
import { getEntitlement, can } from "@/lib/entitlements";
import { SUBJECT_SELECT, subjectName } from "@/lib/subject";
import { SK_ANON, SK_URL } from "@/lib/serverHelpers";
import DIAGRAM_INDEX from "@/lib/diagramIndex.json";

export const runtime = "nodejs";
export const maxDuration = 300; // two sequential Opus passes

const j = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });
const sb = (table: string, opts: any, token: string) => supaRest(SK_URL, table, { apikey: SK_ANON, bearer: token, ...opts });

const LESSON_TYPES = ["terminology", "maths", "practical", "misconception", "extended-writing"] as const;
type LessonType = (typeof LESSON_TYPES)[number];

/* Rank the diagram library against the unit/lesson keywords so the model gets a
   short "use one of these" hint instead of scanning all 117 ids. */
function matchDiagrams(unit: any, lesson: any, max = 5): string {
  const words = new Set(
    [unit?.title, lesson?.title, ...(lesson?.keywords || unit?.keywords || [])]
      .flatMap((s: any) => String(s || "").toLowerCase().split(/[^a-z0-9]+/))
      .filter((w: string) => w.length > 3),
  );
  if (!words.size) return "";
  const scored = (DIAGRAM_INDEX as any[])
    .map((d) => {
      const hay = `${d.title} ${d.parts.map((p: any) => p.label).join(" ")}`.toLowerCase();
      let score = 0;
      for (const w of words) if (hay.includes(w)) score++;
      return { d, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, max);
  if (!scored.length) return "";
  return `Library diagrams that match this topic — use one for the PICTURE IT beat as {type:"diagram", diagramId, build:true}: ${scored
    .map(({ d }) => `${d.id} "${d.title}" (${d.parts.map((p: any) => p.label).join(", ")})`)
    .join("; ")}.`;
}

/* The two-pass instructions per lesson type. Pass 1 builds the deck from empty;
   pass 2 extends the pass-1 deck with the practice/close beats. */
function buildInstructions(unit: any, lesson: any, focus: string | null, lessonType: LessonType): { phase1: string; phase2: string } {
  const disc = subjectName(unit);
  const year = unit?.year_group ? `Year ${unit.year_group}` : "KS3–GCSE";
  const keywords = (lesson?.keywords || unit?.keywords || []);
  const kw = Array.isArray(keywords) && keywords.length ? keywords.join(", ") : "";
  const target = lesson?.title ? `the lesson "${lesson.title}" within the unit "${unit?.title}"` : `the unit "${unit?.title}"`;
  const common = [
    focus ? `Focus the lesson on: ${focus}.` : "",
    kw ? `Weave in these keywords where relevant: ${kw}.` : "",
    matchDiagrams(unit, lesson),
  ].filter(Boolean).join(" ");

  if (lessonType === "extended-writing") {
    return {
      phase1: [
        `Build the first half of an EXTENDED-WRITING (6-marker) skill-builder ${disc} lesson deck for a UK secondary ${year} class on ${target}, following the EXTENDED-WRITING LESSON sequence in the house engine.`,
        `Produce steps 1–7: the TITLE card naming the skill, the DO NOW placeholder, the "RECAP — YOU ALREADY KNOW THIS" retrieve-and-reduce slide, "THE MARKING POINTS", then ONE POINT AT A TIME (a WITHOUT-vs-WITH contrast, a COMPLETE THE SENTENCE, and a MODEL SENTENCE reveal for each marking point), and "THE TRICKY BIT, STEP BY STEP".`,
        common,
      ].filter(Boolean).join(" "),
      phase2: [
        `EXTEND this extended-writing deck with the remaining steps of the EXTENDED-WRITING LESSON sequence, keeping every existing slide unchanged:`,
        `"THE WHOLE PICTURE ON ONE SLIDE" (summary table blank then filled), "EXAM TECHNIQUE" (the reusable sentence shape and the mark arithmetic), "ORACY — REHEARSE" (with a timer), "NOW YOU WRITE IT" (the full 6-marker, scaffold faded), "MODEL ANSWER — MARK IT AGAINST YOURS" (✓ per point), and "GREEN PEN — MARK YOUR OWN" (self-mark checklist).`,
      ].join(" "),
    };
  }

  const typeLine =
    lessonType === "maths" ? `This is a MATHS/QUANTITATIVE lesson — apply that flex: a ROUTINE slide for the sub-skill, WORKED EXAMPLE → YOUR TURN example–problem pairs (identical but for the numbers), faded scaffolding, method-focused CFU, equation elements for formulae.` :
    lessonType === "practical" ? `This is a PRACTICAL/PROCEDURAL lesson — apply that flex: front-load the concept, add PRE-LAB — PREDICT before the method, a slow-practical method sequence, and POST-LAB — EXPLAIN after it.` :
    lessonType === "misconception" ? `This is a MISCONCEPTION-CONFRONTING lesson — apply that flex: open the conceptual section with a diagnostic MCQ whose distractors ARE the known misconceptions, follow with a COGNITIVE CONFLICT slide, resolve, then RE-TEST with a parallel MCQ.` :
    `This is a TERMINOLOGY/CONCEPT lesson (the default engine): cap ~5 new terms, examples AND non-examples, full Etymology / Sentence Builder / Picture It beats.`;

  return {
    phase1: [
      `Build the teaching spine of a complete, ready-to-teach ${disc} lesson deck for a UK secondary ${year} class on ${target}, following the HOUSE LESSON ENGINE beats in order.`,
      typeLine,
      `Produce beats 0–10: TITLE CARD, DO NOW placeholder, ORACY (with a 90-second timer), ETYMOLOGY, TEACHER TALK — CHUNK 1, PICTURE IT, TEACHER TALK — CHUNK 2, SENTENCE BUILDER (blank then filled), CHECK FOR UNDERSTANDING (question slide then answer slide diagnosing each wrong option's misconception), MINI-TASK (task then "Mark in green pen" answers), and the SHORT ANSWER 2–3 mark pair (question then mark-by-mark model).`,
      common,
      `Keep every slide clean and projectable; scientifically accurate at ${year} level.`,
    ].filter(Boolean).join(" "),
    phase2: [
      `EXTEND this lesson deck with the closing beats of the HOUSE LESSON ENGINE, keeping every existing slide unchanged and matching its style:`,
      `INDEPENDENT PRACTICE — CORE (12 questions that RAMP recall → comprehension → apply → explain → misconception → Q12 STRETCH, weaving in 2–3 cross-topic retrieval questions, extending — never repeating — the mini-task), INDEPENDENT PRACTICE — CORE — ANSWERS ("Mark in green pen"), INDEPENDENT PRACTICE — STRETCH (8 questions beyond today) with its ANSWERS slide, and the EXIT CHECK — SHOW ME close (one-sentence whiteboard prompt with success criteria on reveal).`,
    ].join(" "),
  };
}

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return j({ error: "Sign in to generate a lesson." }, 401);
  const token = auth.slice(7);
  if (!process.env.ANTHROPIC_API_KEY) return j({ error: "ANTHROPIC_API_KEY not configured." }, 500);

  let body: any;
  try { body = await req.json(); } catch { return j({ error: "Invalid JSON body" }, 400); }
  const { unitId, lessonId, focus } = body || {};
  if (!unitId) return j({ error: "unitId is required" }, 400);
  const lessonType: LessonType = LESSON_TYPES.includes(body?.lessonType) ? body.lessonType : "terminology";

  // Entitlement gate (soft): only enforced when BILLING_ENFORCED=1, so current
  // pilots stay open until billing is switched on.
  if (process.env.BILLING_ENFORCED === "1") {
    const ent = await getEntitlement({ skUrl: SK_URL, apikey: SK_ANON, bearer: token });
    if (!can(ent, "ai_generators")) return j({ error: "Lesson generation is a Pro feature. Upgrade on the Billing page.", upgrade: true }, 402);
  }

  // Load unit (+ optional lesson) context under the teacher's RLS.
  let unit: any, lesson: any = null;
  try {
    unit = await sb("units", { params: { id: `eq.${unitId}`, select: `id,title,discipline,year_group,keywords,${SUBJECT_SELECT}` }, single: true }, token);
  } catch { return j({ error: "Unit not found" }, 404); }
  if (lessonId) {
    try { lesson = await sb("lessons", { params: { id: `eq.${lessonId}`, select: "id,title,keywords,unit_id" }, single: true }, token); }
    catch { lesson = null; }
  }

  const { phase1, phase2 } = buildInstructions(unit, lesson, typeof focus === "string" ? focus.trim() : null, lessonType);

  // Reuse the proven slides-assistant generator, forwarding the teacher's auth so
  // its own auth + spend metering apply. Pass 1: empty deck → teaching spine.
  const origin = new URL(req.url).origin;
  const callAssistant = async (slides: any[], instruction: string) => {
    const r = await fetch(`${origin}/api/slides-assistant`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ slides, currentSlide: Math.max(0, slides.length - 1), instruction }),
    });
    const d = await r.json();
    if (!r.ok) throw Object.assign(new Error(d?.error || "Generation failed"), { status: r.status });
    return d;
  };

  let gen: any;
  try {
    gen = await callAssistant([], phase1);
  } catch (e: any) {
    return j({ error: e.message }, e.status || 502);
  }
  let slides = Array.isArray(gen?.slides) ? gen.slides : [];
  if (!slides.length) return j({ error: "The generator returned no slides. Try again." }, 502);

  // Pass 2: extend with the practice/close beats. Best-effort — a pass-2 failure
  // still saves the pass-1 deck (the teacher can "extend with independent
  // practice" from the editor's AI panel instead of losing the whole build).
  let phase2Note = "";
  try {
    const gen2 = await callAssistant(slides, phase2);
    if (Array.isArray(gen2?.slides) && gen2.slides.length >= slides.length) slides = gen2.slides;
    else phase2Note = " (practice section didn't generate — ask the AI panel to add it)";
  } catch {
    phase2Note = " (practice section didn't generate — ask the AI panel to add it)";
  }

  const title = lesson?.title || unit?.title || "Generated lesson";

  // Persist as a deck owned by the teacher (owner defaults to auth.uid()).
  let deck: any;
  try {
    const rows = await sb("decks", { method: "POST", body: { title, slides, unit_id: unitId, lesson_id: lessonId || null } }, token);
    deck = Array.isArray(rows) ? rows[0] : rows;
  } catch (e: any) {
    return j({ error: `Couldn't save the deck: ${e.message}` }, 500);
  }

  return j({ deckId: deck.id, title, slideCount: slides.length, summary: (gen.summary || "Lesson generated.") + phase2Note });
}
