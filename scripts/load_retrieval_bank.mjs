#!/usr/bin/env node
/**
 * Bulk-load the KS3 retrieval question bank into the retrieval-app Supabase,
 * authenticated as a MODERATOR (so questions can be shared=true central curriculum).
 *
 * Usage:
 *   SUPA_TOKEN="<moderator access token (JWT)>" node scripts/load_retrieval_bank.mjs
 *
 * Get the token: log into retrieval-app as the moderator, open dev tools console and run
 *   JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.includes('auth-token')))).access_token
 * (or paste a token minted via the auth API). The token is short-lived (~1h).
 *
 * The script reads docs/retrieval/question-bank/_all.jsonl, resolves each question's
 * topic by handbook code, and inserts in batches. Idempotent-ish: it tags rows so a
 * re-run can be detected. Data never leaves your machine except to your own Supabase.
 */
import fs from "node:fs";
import path from "node:path";

const URL = process.env.SUPA_URL || "https://uvzukwoxqhcxaxtzrziy.supabase.co";
const ANON = process.env.SUPA_ANON || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2enVrd294cWhjeGF4dHpyeml5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNDUyNTIsImV4cCI6MjA4OTkyMTI1Mn0.PtT24EfMfTckYaq9jXBPRuCsG6utWMLcHs9H8buM70c";
// Accept either a short-lived access token (SUPA_TOKEN) or — more robust — a
// refresh token (SUPA_REFRESH) which we exchange for a fresh access token, so
// expiry between grabbing and running never bites. Forgiving about pasted
// quotes / whitespace / a leading "Bearer ".
const clean = (v) => (v || "").trim().replace(/^bearer\s+/i, "").replace(/^['"]+|['"]+$/g, "").trim();
let ACCESS = clean(process.env.SUPA_TOKEN);
const REFRESH = clean(process.env.SUPA_REFRESH);
if (!ACCESS && !REFRESH) { console.error("Set SUPA_REFRESH (refresh token) or SUPA_TOKEN (access token) to the MODERATOR's. Aborting."); process.exit(1); }
const MODERATOR_ID = "cef87533-7ff1-4f93-bfcf-22feb66f896a";
const SCIENCE = "10c54ef6-d3ca-439b-9d54-76597ee15e1c";
const BANK = path.resolve(process.cwd(), "docs/retrieval/question-bank/_all.jsonl");

const DIFF = { Foundation: 1, Core: 2, Higher: 3, "GCSE-foundation": 4 };
// (unit, subtopic) -> handbook code (matches the topic name prefix).
const CODE = {
 "MIC|Microscopes":"B1.1","B1|Cell structure":"B1.2","B1|Animal and plant cells":"B1.3","MIC|Magnification":"B1.4",
 "B1|Unicellular organisms":"B1.5","B1|Diffusion":"B1.6","B1|Specialised cells":"B1.7",
 "SKL|The skeleton":"B2.1","SKL|Biomechanics":"B2.2","SKL|Principles of organisation":"B2.3",
 "DIET|Healthy diet, energy requirements and dietary imbalance":"B3.1","DIG|Digestive organs":"B3.2","DIG|Gut bacteria":"B3.3",
 "GAS|Ventilation":"B4.1","GAS|Gas exchange":"B4.2","GAS|Exercise, asthma and smoking":"B4.3",
 "REP|Sexual reproduction and organs":"B5.1","REP|Fertilisation":"B5.2","REP|Fetal development":"B5.3","REP|The menstrual cycle":"B5.4","REP|Plant reproduction":"B5.5",
 "PHO|Photosynthesis":"B6.1","PHO|Leaf structure":"B6.2","RES|Aerobic respiration":"B7.1","RES|Anaerobic respiration":"B7.2",
 "ECO|Food chains":"B8.1","ECO|Food webs and interdependence":"B8.2","ECO|Insect pollination and food security":"B8.3",
 "INH|DNA and chromosomes":"B9.1","INH|Variation":"B9.2","INH|Competition and natural selection":"B9.3","BIO|Biodiversity":"B9.4",
 "C1|Simple particle model":"C1.1","C1|Properties of states of matter":"C1.2","C1|Changes of state":"C1.3","PRS|Gas pressure":"C1.4",
 "C2|The atomic model":"C2.1","C2|Symbols and formulae":"C2.2","ELC|Elements and compounds":"C2.3",
 "PUR|Diffusion":"C3.1","PUR|Pure and impure":"C3.2","PUR|Separation":"C3.3",
 "CHR|Reactions and signs of reaction":"C4.1","CHR|Combustion, thermal decomposition, oxidation, displacement":"C4.2","CHR|Conservation of mass":"C4.3",
 "ACD|Acids, alkalis and pH":"C4.4","ACD|Reactions of acids with metals and alkalis":"C4.5",
 "ENC|Changes of state":"C5.1","ENC|Endothermic and exothermic reactions":"C5.2",
 "PER|Properties of metals and non-metals":"C6.1","PER|Groups, periods, metals and non-metals":"C6.2",
 "MAT|Metal reactivity":"C7.1","MAT|Metal extraction with carbon":"C7.2","MAT|Ceramics, polymers and composites":"C7.3",
 "EAR|Composition and structure of the Earth":"C8.1","EAR|The rock cycle":"C8.2","EAR|Composition of the atmosphere":"C8.3","EAR|The carbon cycle":"C8.4","EAR|Recycling":"C8.5",
 "P1|Fuels and energy stores":"P1.1","P1|Energy stores and transfers":"P1.2","PWR|Power":"P1.3","ENR|Energy resources":"P1.4",
 "SPD|Speed":"P2.1","SPD|Distance-time graphs":"P2.2","SPD|Relative motion":"P2.3",
 "FRC|Basic forces and diagrams":"P3.1","FRC|Naming/categorising forces":"P3.2","FRC|Stretching and squashing":"P3.3","FRC|Hooke's law and work done":"P3.4","FRC|Moments and simple machines":"P3.5","FRC|Balanced forces":"P3.6","FRC|Forces and motion":"P3.7",
 "PRS|Pressure in liquids":"P4.1","PRS|Atmospheric pressure":"P4.2","PRS|Pressure calculations":"P4.3",
 "SND|Types of wave":"P5.1","SND|Sound waves":"P5.2","SND|Microphones and ultrasound":"P5.3",
 "LGT|Light and ray models":"P6.1","LGT|Interactions with materials":"P6.2","LGT|Mirrors, pinhole cameras and the eye":"P6.3","LGT|Detecting light and colour":"P6.4",
 "ELE|Conductors and insulators":"P7.1","ELE|Circuits, current, p.d. and resistance":"P7.2","ELE|Series and parallel circuits":"P7.3",
 "STA|Static charges":"P8.1","STA|Electric fields":"P8.2",
 "MAG|Magnets and magnetic fields":"P9.1","MAG|Earth's magnetism":"P9.2","MAG|Electromagnets and motors":"P9.3",
 "DEN|Particle model and density":"P10.1","DEN|Energy in matter":"P10.2",
 "SPC|Stars, planets and galaxies":"P11.1","SPC|The seasons":"P11.2","SPC|Weight":"P11.3",
};

let H = { apikey: ANON, "content-type": "application/json" };

async function main() {
  // If only a refresh token was given, exchange it for a fresh access token.
  if (!ACCESS && REFRESH) {
    const rr = await fetch(`${URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST", headers: { apikey: ANON, "content-type": "application/json" },
      body: JSON.stringify({ refresh_token: REFRESH }),
    });
    const rd = await rr.json().catch(() => ({}));
    if (!rr.ok || !rd.access_token) { console.error("Refresh failed:", rd.error_description || rd.msg || rd.error || rr.status, "— re-grab the refresh token while logged in as the moderator."); process.exit(1); }
    ACCESS = rd.access_token;
  }
  H.Authorization = `Bearer ${ACCESS}`;
  // who am I (created_by + sanity)
  const me = await (await fetch(`${URL}/auth/v1/user`, { headers: H })).json();
  if (!me?.id) { console.error("Token invalid / expired — re-grab it (refresh token preferred)."); process.exit(1); }
  console.log("Authed as", me.id, me.email || "");
  if (me.id !== MODERATOR_ID) {
    console.warn(`Note: this account (${me.id}) is not the known moderator (${MODERATOR_ID}).\n  Proceeding, but the database only lets a moderator/HoD publish SHARED questions.\n  I'll report below whether they actually went public.\n`);
  }

  // topic code -> id
  const topics = await (await fetch(`${URL}/rest/v1/topics?subject_id=eq.${SCIENCE}&key_stage=eq.KS3&select=id,name`, { headers: H })).json();
  const byCode = {};
  for (const t of topics) {
    const code = (t.name || "").split(" ")[0];
    if (!(code in byCode) || t.name < byCode[code].name) byCode[code] = t;
  }

  const lines = fs.readFileSync(BANK, "utf8").split("\n").filter(Boolean);
  const rows = []; const unmapped = new Set();
  for (const l of lines) {
    const j = JSON.parse(l);
    const code = CODE[`${j.unit}|${j.subtopic}`];
    const topic = code && byCode[code];
    if (!topic) { unmapped.add(`${j.unit}|${j.subtopic}`); continue; }
    let kind = j.type, options = null, correct_index = null;
    let model = Array.isArray(j.answer) ? j.answer.join("; ") : String(j.answer);
    if (kind === "mcq" && Array.isArray(j.options) && Number.isInteger(j.correct) && j.correct >= 0 && j.correct < j.options.length) {
      options = j.options; correct_index = j.correct; model = j.options[j.correct];
    } else if (kind === "mcq") { kind = "short"; }
    if (!["short", "mcq", "numeric"].includes(kind)) kind = "short";
    rows.push({
      topic_id: topic.id, question_text: j.question, model_answer: model,
      marks: j.marks || 1, difficulty: DIFF[j.difficulty] || 2, kind, options, correct_index,
      subtopic: j.subtopic, skill: j.skill, misconceptions: j.misconceptions || null, accept: j.accept || null,
      shared: true, archived: false, tier: "Both", created_by: me.id,
    });
  }
  if (unmapped.size) { console.error("UNMAPPED:", [...unmapped]); process.exit(1); }
  console.log(`Prepared ${rows.length} rows. Inserting in batches…`);

  let done = 0;
  for (let i = 0; i < rows.length; i += 300) {
    const batch = rows.slice(i, i + 300);
    const r = await fetch(`${URL}/rest/v1/questions`, { method: "POST", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(batch) });
    if (!r.ok) { console.error(`Batch @${i} failed: ${r.status} ${await r.text()}`); process.exit(1); }
    done += batch.length; process.stdout.write(`\r  inserted ${done}/${rows.length}`);
  }
  console.log(`\nInserted ${done} questions (created_by=${me.id}).`);
  // Verify how many actually went public — the shared_guard trigger silently
  // forces shared=false for non-moderator/HoD accounts.
  const chk = await (await fetch(`${URL}/rest/v1/questions?created_by=eq.${me.id}&archived=eq.false&select=shared`, { headers: H })).json();
  const yes = Array.isArray(chk) ? chk.filter(x => x.shared).length : 0;
  const no = Array.isArray(chk) ? chk.length - yes : 0;
  console.log(`Visibility: ${yes} SHARED (all students see), ${no} not shared.`);
  if (yes === 0) {
    console.log("\n  ⚠ None went public — this account can't publish a central bank.");
    console.log("    Re-run logged in as the moderator/HoD account, or tell Claude and");
    console.log("    they'll confirm which account has rights. (These rows are harmless;");
    console.log("    they're only visible to your own classes until shared.)");
  } else {
    console.log("Done — the bank is live.");
  }
}
main().catch(e => { console.error(e); process.exit(1); });
