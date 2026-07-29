#!/usr/bin/env node
// Extract the Springboard living diagrams into a reusable library for the Slides app.
//
// Sources (both in apps/houchell/public/learn/):
//   springboard.html — `const DIAGRAMS={...}` (pure JSON): 117 diagrams, each
//                      { vb, svg, parts:[{id,label,x,y,note}] } with data-part
//                      groups and sm-* animation classes.
//   content.js       — window.SPRINGBOARD_CONTENT: units keyed by code, each with
//                      { title, discipline, blurb, vocab, diagram:{key} } — maps
//                      diagram ids to curriculum units for search/keywords.
//
// Outputs:
//   apps/houchell/public/diagrams/<id>.svg      — self-contained SVG per diagram:
//       viewBox, embedded <style> (sm-* keyframes so the diagram stays "alive"),
//       the original art, plus baked-in part labels (dot + haloed text) inside
//       data-part groups so labels reveal with their parts.
//   apps/houchell/src/lib/diagramCatalog.json    — metadata for the editor picker:
//       id, title, discipline, unit, parts (id/label/note), vb, keywords.
//   apps/houchell/src/lib/diagramIndex.json      — slim index (no notes/keywords)
//       imported by the edge AI routes to validate ids and build the prompt list.
//
// Re-run whenever springboard.html / content.js change:
//   node scripts/extract-diagram-library.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const learnDir = path.join(root, "apps/houchell/public/learn");
const outSvgDir = path.join(root, "apps/houchell/public/diagrams");
const outCatalog = path.join(root, "apps/houchell/src/lib/diagramCatalog.json");

// ── 1. Parse DIAGRAMS out of springboard.html ────────────────────────────────
const html = fs.readFileSync(path.join(learnDir, "springboard.html"), "utf8");
const dStart = html.indexOf("const DIAGRAMS={");
if (dStart < 0) throw new Error("const DIAGRAMS={ not found in springboard.html");
const dTail = html.slice(dStart);
const dEnd = dTail.indexOf("\n};");
if (dEnd < 0) throw new Error("end of DIAGRAMS object not found");
const DIAGRAMS = JSON.parse(dTail.slice("const DIAGRAMS=".length, dEnd + 2));

// ── 2. Load the unit map from content.js ─────────────────────────────────────
globalThis.window = {};
await import(path.join(learnDir, "content.js"));
const CONTENT = globalThis.window.SPRINGBOARD_CONTENT || {};
const unitByDiagram = {};
for (const code of Object.keys(CONTENT)) {
  const u = CONTENT[code];
  const key = u?.diagram?.key;
  if (key) unitByDiagram[key] = { code, title: u.title, discipline: u.discipline || "", blurb: u.blurb || "", vocab: (u.vocab || []).map((v) => v.term).filter(Boolean) };
}

// Hand-labelled homes for the diagrams no unit references directly.
const ORPHANS = {
  circuit: { title: "Simple circuit", discipline: "physics" },
  plantCell: { title: "Plant cell", discipline: "biology" },
  arm: { title: "Arm — muscles and bones", discipline: "biology" },
  wave: { title: "Wave — amplitude and wavelength", discipline: "physics" },
  reflection: { title: "Reflection — ray diagram", discipline: "physics" },
  forces: { title: "Forces on an object", discipline: "physics" },
  skeleton: { title: "Skeleton", discipline: "biology" },
};

// ── 3. Pull the sm-* animation CSS straight from the page so it stays in sync ─
const smRules = [...html.matchAll(/^\s*(\.sm-[a-z-]+\{[^\n]*\}|@keyframes sm-[a-z-]+\{[^\n]*\})\s*$/gm)].map((m) => m[1].trim());
if (!smRules.some((r) => r.startsWith("@keyframes"))) throw new Error("sm-* keyframes not found in springboard.html");
const SVG_STYLE = [
  // Same defaults the Springboard page applies to the inline SVG art.
  '[class*="sm-"]{transform-box:fill-box;transform-origin:center;}',
  "[data-part]{transition:opacity .55s ease;}",
  ...smRules,
  '@media (prefers-reduced-motion:reduce){[class*="sm-"]{animation:none !important;}}',
  ".dg-label text{font-family:'Century Gothic','Avenir Next',system-ui,sans-serif;font-weight:600;paint-order:stroke;stroke:#ffffff;stroke-width:3px;stroke-linejoin:round;fill:#1E2761;}",
  ".dg-label circle{fill:#1E2761;stroke:#ffffff;stroke-width:1.5;}",
].join("\n");

// ── 4. Build each standalone SVG (art + baked part labels) ────────────────────
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function labelMarkup(part, vb) {
  const [vx, vy, w, h] = vb;
  const px = vx + (part.x / 100) * w;
  const py = vy + (part.y / 100) * h;
  const fs = Math.max(10.5, Math.round(w / 27)); // ~12px on the standard 320-wide canvas
  // Keep the text on-canvas: anchor away from the nearest edge, sit above the
  // dot unless that would clip at the top.
  const anchor = part.x < 22 ? "start" : part.x > 78 ? "end" : "middle";
  const tx = anchor === "start" ? px + 7 : anchor === "end" ? px - 7 : px;
  const above = py > vy + fs + 10;
  const ty = above ? py - 8 : py + fs + 8;
  return `<g data-part="${esc(part.id)}" class="dg-label"><circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="3.4"/><text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" font-size="${fs}" text-anchor="${anchor}">${esc(part.label)}</text></g>`;
}

fs.mkdirSync(outSvgDir, { recursive: true });
const catalog = [];
let written = 0;

for (const id of Object.keys(DIAGRAMS)) {
  const d = DIAGRAMS[id];
  const vb = (d.vb || "0 0 320 220").trim().split(/\s+/).map(Number);
  const unit = unitByDiagram[id] || null;
  const orphan = ORPHANS[id] || null;
  const title = unit ? unit.title : orphan ? orphan.title : id.replace(/^d_/, "").replace(/([a-z])([A-Z])/g, "$1 $2");
  const discipline = unit ? unit.discipline : orphan ? orphan.discipline : "";
  const parts = (d.parts || []).map((p) => ({ id: p.id, label: p.label, note: p.note || "" }));
  const labels = (d.parts || []).filter((p) => p.label && Number.isFinite(p.x) && Number.isFinite(p.y)).map((p) => labelMarkup(p, vb)).join("\n");

  // width/height 100%: an inline SVG without them renders at the 300×150 default.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${d.vb}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(title)}">
<style>${SVG_STYLE}</style>
<g class="diagram-art">
${d.svg}
</g>
${labels}
</svg>
`;
  fs.writeFileSync(path.join(outSvgDir, `${id}.svg`), svg);
  written++;

  catalog.push({
    id,
    title,
    discipline,
    unitCode: unit?.code || null,
    unitTitle: unit?.title || null,
    vb: d.vb,
    parts,
    keywords: [...new Set([
      ...title.toLowerCase().split(/[^a-z0-9]+/),
      ...(unit?.vocab || []).map((t) => t.toLowerCase()),
      ...parts.map((p) => p.label.toLowerCase()),
    ].filter((k) => k && k.length > 2))],
  });
}

fs.writeFileSync(outCatalog, JSON.stringify(catalog, null, 1));

// Slim index for the edge AI routes (validate ids, list diagrams in the prompt)
// — the full catalog's notes/keywords would bloat the edge bundle for nothing.
const outIndex = path.join(root, "apps/houchell/src/lib/diagramIndex.json");
fs.writeFileSync(outIndex, JSON.stringify(
  catalog.map((c) => ({ id: c.id, title: c.title, discipline: c.discipline, unitCode: c.unitCode, vb: c.vb, parts: c.parts.map((p) => ({ id: p.id, label: p.label })) })),
));

console.log(`Wrote ${written} SVGs to ${path.relative(root, outSvgDir)}/`);
console.log(`Wrote catalog (${catalog.length} entries, ${(fs.statSync(outCatalog).size / 1024).toFixed(0)} KB) to ${path.relative(root, outCatalog)}`);
console.log(`Wrote index (${(fs.statSync(outIndex).size / 1024).toFixed(0)} KB) to ${path.relative(root, outIndex)}`);
const missing = catalog.filter((c) => !c.discipline).map((c) => c.id);
if (missing.length) console.warn("No discipline for:", missing.join(", "));
