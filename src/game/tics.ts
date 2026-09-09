/**
 * THE ROMANCE TICS.
 *
 * Weft already hunts the narrator's habits — stated interiors, maxims, echoes,
 * the narrator reprinting itself — and it does it well. But that pattern list
 * was mined out of survival and horror saves, and romance has an entirely
 * separate vocabulary of filler that none of those detectors will ever see.
 *
 * The failure is specific and it is worth naming precisely, because it is what
 * makes generated romance read as slop. When a model has nothing to write, it
 * reaches for the body: a breath catches, a pulse quickens, something
 * unreadable crosses a face, a flush climbs a neck. None of these sentences
 * contain information. They are a way of asserting that a moment was charged
 * without doing the work of making it charged, and once one appears the next
 * three arrive within a paragraph, because the model is now imitating itself.
 *
 * Two halves here:
 *
 *   NO_TROPES  — a prompt fragment pasted into every generation call in the
 *                dating layer. Prevention, and it is worth roughly half.
 *   findTics() — a detector over what actually came back, because a rule in a
 *                cached prefix is reference material and the only thing that
 *                has ever reliably broken a narrator habit is being shown the
 *                sentence it just wrote. The catch is quoted back on the next
 *                turn's directive, the same mechanism Weft uses for maxims.
 *
 * Dialogue is exempt from every pattern here. A person is allowed to say "I've
 * never felt like this"; people do say it. What is forbidden is the NARRATION
 * saying it on their behalf.
 */

export const NO_TROPES = `FORBIDDEN, in narration (a character may still SAY any of it out loud):
- Bodies used as emotional shorthand: breath catching, hearts hammering or stuttering, pulses quickening, stomachs dropping or flipping, chests tightening, throats going dry, flushes climbing necks, butterflies. If a body does something, it must be something an observer in the room could see and it must not be there to tell the reader how to feel.
- Faces doing unreadable things: an expression that cannot be placed, something flickering across a face, an emotion the narration names but declines to explain, eyes that are unreadable or guarded or searching.
- Charged air: electricity, tension, a charge, the space between them, air that is thick or heavy with anything.
- Voices doing the work: a voice rough with feeling, barely above a whisper, thick, unsteady, or lower than it was.
- Lips: bitten, worried, parted. Once per story is already too much.
- The chosen-one line: nobody has ever, you are not like other people, this has never happened before, I did not know it could be like this.
- Any sentence stating what a person feels, wants, knows, realises, decides, or has just understood. The camera is in the room and has no access to anyone's interior.
- Any closed general truth about love, people, women, men, or life — in narration OR in dialogue. No aphorisms, no maxims, no proverbs, no "that is what X does". If a sentence would work as a caption on a photograph of a sunset, delete it.
- Characters describing the conversation they are having while having it.

WRITE INSTEAD: what is done, what is said, what is in the room, what somebody is holding, what they do with their hands while they are not talking, what they get wrong, what they decline to answer. Specific, plain, and uninterested in being beautiful.`;

export interface Tic {
  family: string;
  /** The offending phrase, verbatim, for quoting back. */
  phrase: string;
  /** The whole sentence it sat in. */
  sentence: string;
}

/** Each family is a set of patterns and a name. Order matters only for
 *  reporting: the first family to match a sentence claims it, so a sentence is
 *  never reported twice. */
const FAMILIES: { family: string; patterns: RegExp[] }[] = [
  {
    family: "the body as shorthand",
    patterns: [
      /\b(?:h(?:er|is|their)|the)\s+breath\s+(?:catch|caught|hitch|hitched|stutter\w*|snag\w*)/i,
      /\bbreath\s+(?:catches|caught)\s+in\s+\w+\s+throat/i,
      /\b(?:heart|pulse)\s+(?:hammer\w*|pound\w*|stutter\w*|skip\w*|quicken\w*|thud\w*|lurch\w*|kick\w*)/i,
      /\bstomach\s+(?:drop\w*|flip\w*|turn\w*|lurch\w*|swoop\w*|twist\w*)/i,
      /\b(?:chest|throat)\s+(?:tighten\w*|constrict\w*|close\w*|go(?:es)? dry|went dry)/i,
      /\b(?:a\s+)?(?:flush|blush|heat|colou?r)\s+(?:creep\w*|crawl\w*|climb\w*|rose|rising|spread\w*|bloom\w*)/i,
      /\bbutterflies\b/i,
      /\bheat\s+(?:pool\w*|coil\w*|curl\w*|bloom\w*)\b/i,
      /\bwarmth\s+spread\w*\s+through\b/i,
      /\bskin\s+(?:prickl\w*|tingl\w*)/i,
    ],
  },
  {
    family: "the unreadable face",
    patterns: [
      /\bsomething\s+(?:unreadable|indecipherable|unnameable|she couldn't|he couldn't|they couldn't|you couldn't)\b/i,
      /\bsomething\s+\w{3,12}\s+(?:flicker\w*|flit\w*|cross\w*|pass\w*|move\w*)\s+(?:across|over|behind)\s+(?:h(?:er|is|their)|the)\s+(?:face|eyes|features)/i,
      /\ban?\s+expression\s+(?:\w+\s+){0,3}(?:couldn't|could not|cannot)\s+(?:place|read|name)/i,
      /\beyes\s+(?:were\s+)?(?:unreadable|guarded|searching|shuttered|veiled)\b/i,
      /\b(?:h(?:er|is|their))\s+face\s+(?:did something|closed off|shuttered)\b/i,
    ],
  },
  {
    family: "charged air",
    patterns: [
      /\bthe\s+(?:air|space|silence)\s+between\s+(?:them|you|us)\b/i,
      /\b(?:electricity|a charge|a current)\s+(?:between|in the air|passed)/i,
      /\bair\s+(?:was\s+)?(?:thick|heavy|charged|crackl\w*)\s+with\b/i,
      /\b(?:tension|awareness)\s+(?:hummed|crackled|thickened|stretched)\b/i,
      /\bcharged\s+(?:silence|moment|pause)\b/i,
    ],
  },
  {
    family: "the voice doing the work",
    patterns: [
      /\bvoice\s+(?:was\s+)?(?:rough|thick|hoarse|unsteady|raw)\s+with\b/i,
      /\bbarely\s+(?:above\s+)?a\s+whisper\b/i,
      /\bvoice\s+(?:dropp\w*|lower\w*)\s+(?:to|into)\b/i,
      /\bin\s+a\s+voice\s+(?:she|he|they|you)\s+(?:had\s+)?(?:never|hadn't)\b/i,
    ],
  },
  {
    family: "lips",
    patterns: [
      /\b(?:bit|bites|biting|worried|worries|worrying)\s+(?:at\s+)?(?:h(?:er|is|their))\s+(?:lower\s+|bottom\s+)?lip\b/i,
      /\blips\s+(?:parted|part)\b/i,
      /\bgaze\s+(?:dropp\w*|fell|flick\w*)\s+to\s+(?:h(?:er|is|their))\s+mouth\b/i,
    ],
  },
  {
    family: "the chosen-one line",
    patterns: [
      /\b(?:no\s?one|nobody)\s+(?:has\s+)?ever\s+(?:looked at|talked to|touched|seen|asked|made)\s+(?:h(?:er|im|them)|you|me)\b/i,
      /\b(?:you'?re|she'?s|he'?s|they'?re)\s+not\s+like\s+(?:other|anyone|any of)\b/i,
      /\b(?:didn'?t|did not)\s+know\s+it\s+could\s+(?:be|feel)\s+like\s+this\b/i,
      /\bfor\s+the\s+first\s+time\s+in\s+(?:h(?:er|is|their))\s+life\b/i,
    ],
  },
  {
    family: "the stated interior",
    patterns: [
      /\b(?:she|he|they|you)\s+(?:realis\w+|realiz\w+)\s+(?:that\s+)?(?:she|he|they|you|it|the)\b/i,
      /\b(?:she|he|they)\s+(?:knew|understood|decided|wanted)\s+(?:then\s+)?that\b/i,
      /\bsomewhere\s+in\s+the\s+back\s+of\s+(?:h(?:er|is|their))\s+mind\b/i,
      /\bwithout\s+(?:quite\s+)?knowing\s+why\b/i,
      /\b(?:she|he|they)\s+was\s+(?:suddenly\s+)?aware\s+(?:of|that)\b/i,
    ],
  },
  {
    family: "the aphorism",
    patterns: [
      /\bthat'?s\s+(?:what|how)\s+(?:love|people|men|women|grief|wanting)\s+(?:is|does|works)\b/i,
      /\blove\s+(?:is|isn'?t|was|wasn'?t)\s+\w+ing\b/i,
      /\b(?:people|men|women)\s+(?:always|never)\s+\w+\s+(?:when|what|the)\b/i,
      /\bthe\s+thing\s+about\s+\w+\s+is\s+that\b/i,
    ],
  },
];

/** Split into sentences without breaking inside quoted dialogue, so a line
 *  somebody actually said is never chopped in half and half-flagged. */
function sentences(text: string): { text: string; quoted: boolean }[] {
  const out: { text: string; quoted: boolean }[] = [];
  for (const para of text.split(/\n+/)) {
    let depth = 0, buf = "";
    for (const ch of para) {
      if (ch === '"' || ch === "“") depth++;
      if (ch === "”") depth = Math.max(0, depth - 1);
      buf += ch;
      if (/[.!?]/.test(ch) && depth % 2 === 0) {
        out.push({ text: buf.trim(), quoted: /["“”]/.test(buf) });
        buf = "";
      }
    }
    if (buf.trim()) out.push({ text: buf.trim(), quoted: /["“”]/.test(buf) });
  }
  return out.filter((s) => s.text.length > 4);
}

/**
 * Find the tics in one turn of narration.
 *
 * THE DIALOGUE EXEMPTION is absolute and it is the right way round. Any sentence
 * carrying a quotation mark is skipped entirely, which means a narration
 * sentence that happens to quote two words keeps its tic. That is a real cost
 * and it is worth paying: rewriting a line somebody actually said, in a game
 * about listening to what somebody says, would be the worse failure by a wide
 * margin.
 */
export function findTics(prose: string, limit = 4): Tic[] {
  const found: Tic[] = [];
  for (const s of sentences(prose)) {
    if (s.quoted) continue;
    for (const { family, patterns } of FAMILIES) {
      const hit = patterns.map((p) => s.text.match(p)).find(Boolean);
      if (hit) {
        found.push({ family, phrase: hit[0].trim(), sentence: s.text });
        break;
      }
    }
    if (found.length >= limit) break;
  }
  return found;
}

/** Quoted back at the narrator on the next turn. Weft's own maxim and leak
 *  detectors work exactly this way and it is the only correction mechanism in
 *  the engine that reliably changes behaviour — a rule in the system prompt is
 *  read as reference, a sentence you just wrote is read as a mistake. */
export function ticCorrection(tics: Tic[]): string {
  if (!tics.length) return "";
  const list = tics.slice(0, 3).map((t) => `  "${t.phrase}" — ${t.family}`).join("\n");
  return [
    `LAST TURN YOU WROTE THESE, AND THEY ARE THE HOUSE STYLE OF BAD ROMANCE:`,
    list,
    `Do not write anything of that kind this turn. Write what is done and said instead. If you cannot find a way to make a moment land without reaching for a body part or a charged silence, then let it not land — an ordinary moment written plainly is worth more than a charged one written like everybody else's.`,
  ].join("\n");
}

/** For the small gauge in the journal: how clean was this run. */
export function ticRate(history: { narrator_prose?: string }[], window = 12): number {
  const recent = history.slice(-window).filter((h) => h.narrator_prose);
  if (!recent.length) return 0;
  const hit = recent.filter((h) => findTics(h.narrator_prose!, 1).length > 0).length;
  return hit / recent.length;
}
