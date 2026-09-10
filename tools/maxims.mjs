/**
 * A linter for the way I write.
 *
 * Three separate hand-passes over this codebase each removed the aphorisms and
 * each wrote new ones, because the constructions are a default rather than a
 * decision and I cannot reliably hear them in my own output. So they get
 * matched instead of judged.
 *
 * This is deliberately noisy and has no authority. It prints candidates and a
 * person decides. Some hits are fine — "not X, Y" is a legitimate English
 * construction and this will flag every one of them. The number going down over
 * time is the signal, not any individual line.
 *
 *   node tools/maxims.mjs            everything, worst files first
 *   node tools/maxims.mjs --prompts  only the text models actually read
 *   node tools/maxims.mjs --max 40   fail above a threshold, for CI
 */
import { readFileSync } from "node:fs";
import { globSync } from "node:fs";

const PATTERNS = [
  { name: "negate-and-correct", why: "X, not Y — a correction handed over in place of a description",
    re: /,\s+not\s+(?:a\s|an\s|the\s)?[a-z][\w'-]*(?:\s+[a-z][\w'-]*){0,3}[.,;]/g },
  { name: "is-not-X-it-is-Y", why: "the definition swap",
    re: /\b(?:is|are|was|were)\s+not\s+(?:a|an|the)\b[^.;]{0,50}[;—,-]\s*(?:it|they)\s+(?:is|are)\b/gi },
  { name: "does-not-exist-to", why: "X does not exist to Y",
    re: /\b(?:does|do|did)\s+not\s+exist\s+to\b/gi },
  { name: "cleft", why: "what X cannot be is Y",
    // Anchored to a sentence start so it stops matching ordinary noun phrases
    // like the beat title "What they are unhappy about".
    re: /(?:^|[.;!?]\s+|`)[Ww]hat\s+(?:it|they|she|he|you|that|this|we)\s+(?:cannot|can't|is|are|does|do)\b[^.;]{0,40}\bis\b/gm },
  { name: "portable-verdict", why: "a general sentence about a class of thing, usually ending in has failed / is not a X",
    re: /\bA\s+[a-z][\w'-]*(?:\s+[a-z][\w'-]*){0,6}\s+(?:that|which|where|whose)\b[^.]{0,70}\b(?:has failed|is not|are not|is never|is the|is what)\b/g },
  { name: "that-is-what-X-is-for", why: "closing appeal to purpose",
    re: /\b[Tt]hat\s+is\s+what\s+[\w' ]{2,30}\s+(?:is|are)\s+for\b/g },
  { name: "never-a-X", why: "verbless prohibition as a sentence",
    re: /(?:^|[.!?]\s)Never\s+(?:a|an|the)\s+[a-z][\w'-]*\./gm },
  { name: "the-X-is-the-Y", why: "equation dressed as insight",
    re: /\b[Tt]he\s+[a-z][\w'-]*\s+is\s+the\s+[a-z][\w'-]*\b(?!\s+(?:of|that|which|who|for|in|on|at|to))/g },
  { name: "worse-than", why: "comparative verdict as a closer",
    // "beats" as a verb was in here and collided with "beats" the domain noun,
    // which is the most common word in this codebase. Require the comparative
    // shape rather than the bare verb.
    re: /\bis\s+worse\s+than\b|\b(?:always|still)\s+beats\s+[a-z]/gi },
  { name: "one-thing-that", why: "the only X that ever",
    re: /\bthe\s+only\s+(?:thing|one|way|part)\b[^.]{0,40}\bever\b/gi },
];

const args = new Set(process.argv.slice(2));
const maxArg = process.argv.indexOf("--max");
const max = maxArg > -1 ? Number(process.argv[maxArg + 1]) : null;

// The strings a model reads matter more than a comment I wrote to myself.
const PROMPT_FILES = ["src/game/tics.ts", "src/game/gate.ts", "src/game/casting.ts", "src/game/appetite.ts"];
const files = args.has("--prompts")
  ? PROMPT_FILES
  : globSync("src/**/*.{ts,tsx}", { cwd: process.cwd() });

const byFile = new Map();
let total = 0;

for (const f of files) {
  let src;
  try { src = readFileSync(f, "utf8"); } catch { continue; }
  const lines = src.split("\n");
  const hits = [];
  for (const { name, why, re } of PATTERNS) {
    for (const m of src.matchAll(re)) {
      const line = src.slice(0, m.index).split("\n").length;
      hits.push({ line, name, why, text: lines[line - 1].trim().slice(0, 96) });
    }
  }
  if (hits.length) {
    hits.sort((a, b) => a.line - b.line);
    byFile.set(f, hits);
    total += hits.length;
  }
}

const ranked = [...byFile.entries()].sort((a, b) => b[1].length - a[1].length);
for (const [f, hits] of ranked) {
  console.log(`\n${f}  —  ${hits.length}`);
  for (const h of hits) console.log(`  ${String(h.line).padStart(4)}  [${h.name}]  ${h.text}`);
}

console.log(`\n${total} candidates across ${byFile.size} files.`);
console.log("None of these are automatically wrong. The number going down is the point.");

if (max != null && total > max) {
  console.error(`\nOver the threshold of ${max}.`);
  process.exit(1);
}
