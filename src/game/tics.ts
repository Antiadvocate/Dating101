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

export const NO_TROPES = `HOW PEOPLE TALK AND HOW THE PAGE DESCRIBES THEM

Most of what anybody says is unremarkable, and that is what makes the occasional good line land. If every line out of somebody's mouth is clever, or pointed, or has a little twist at the end of it, they stop reading as a person and start reading as a performance. Aim for most lines being flat — answers to questions, half-sentences, somebody saying the boring true thing. At most one line in a whole scene should be the memorable one, and plenty of scenes should not have one at all.

Don't have a character comment on the conversation they are in the middle of having. Nobody says "that's a very specific compliment" or "you're deflecting" or "that's not really an answer." People just respond to the thing, or don't.

Don't let anybody say a sentence that would work equally well in any other story, said by anyone, to anyone. That includes anything shaped like a general observation about people, or love, or how things go — even when it is dressed up as a specific remark about the moment. If you could put the line on a poster, it is wrong.

Names in dialogue are rare. In real speech you almost never say the name of the person you are talking to, and using it constantly is one of the clearest signs that a machine wrote the exchange. Once in a scene, at most, and usually to get somebody's attention or because they are about to be told something serious.

Don't describe an expression without saying what it is. Writing that somebody's mouth did something at the corner, or that something crossed their face, or that their eyes did something you decline to name, is a way of implying a moment was significant without doing the work. Either say what the face did in plain words, or leave the face alone and describe what she does with her hands.

Don't tell the reader what anyone feels, wants, knows, decides, or has just worked out. You have access to what somebody standing in the room could see and hear, and nothing else.

Don't use the body as shorthand for a feeling. Breath catching, hearts hammering, stomachs dropping, throats going dry, flushes climbing necks, chests tightening — all of that is a way of telling the reader how to feel without giving them anything to look at.

Don't charge the atmosphere. The air between them, the silence, the steam, the space — none of these should be carrying meaning. If a moment is loaded, it is loaded because of what somebody just said.

Don't write in the shape of "not that, just this." Sentences like "she said it slowly, not mocking, just testing how it sat" put a correction in front of the reader instead of an image, and they are a habit rather than a description. Say the thing you mean once.

Don't put a simile in front of an interior to smuggle it in. "She said it flat, like she was weighing it" is still telling the reader what she was doing in her head.

WRITE INSTEAD: what people do while they are talking, what they are holding, what they get wrong, what they don't answer, what somebody has to move out of the way, what the room sounds like. Let people be boring. Let a line land badly and nobody remark on it. A character is allowed to say "yeah" and nothing else.`;

/**
 * The same job for sex, where the failure has a different shape.
 *
 * Generated sex writing usually goes abstract at exactly the point it should
 * get specific. The prose holds up fine until clothes come off, and then the
 * nouns turn into euphemisms and the verbs turn into weather, and two people
 * who were distinct a paragraph ago become anybody.
 */
export const NO_PURPLE = `WRITING SEX

Write it the same way you write everything else in this story: plain nouns, plain verbs, these two specific people, in this room, tonight. The thing to avoid is not explicitness, it is vagueness.

Don't use euphemisms for body parts. No core, heat, sex, entrance, folds, length, member, womanhood, manhood, bud, petals, velvet. Use the ordinary word for the thing, or describe what is being done without naming the part at all.

Don't use weather or physics for sensation. No waves, jolts, sparks, currents, electricity, fire, shattering, coming undone, unravelling, seeing stars, the world narrowing to a point.

Don't reach for superlatives with nothing under them — better than anything, more than she could take, never like this before.

Don't make the body a separate character that overrules the person. Nobody's body betrays them or responds of its own accord. People do things.

Don't use blunt force verbs as a way of signalling intensity: pounded, slammed, buried, impaled, filled completely.

WRITE INSTEAD: who does what, in what order, what gets said, what is awkward, what has to be moved, what somebody stops to do, what one of them laughs at, whose arm has gone dead. Two people doing this for the first time are different from two people who have done it a hundred times, and both are different from these two.`;

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
    // Broadened after a passage where every one of these fired in a reader's
    // head and not one of them fired here. The old patterns matched specific
    // wordings ("something unreadable crossed her face") and the model simply
    // wrote the same move in words I had not thought of: "her mouth does
    // something small at the corner". The move is a face doing an unnamed
    // thing, so match the move.
    family: "the unnamed expression",
    patterns: [
      /\bsomething\s+(?:unreadable|indecipherable|unnameable|she couldn't|he couldn't|they couldn't|you couldn't)\b/i,
      /\bsomething\s+\w{0,12}\s*(?:flicker\w*|flit\w*|cross\w*|pass\w*|move\w*|shift\w*)\s+(?:across|over|behind|through)\s+(?:h(?:er|is|their)|the)\s+(?:face|eyes|features|mouth)/i,
      /\ban?\s+expression\s+(?:\w+\s+){0,3}(?:couldn't|could not|cannot)\s+(?:place|read|name)/i,
      /\beyes\s+(?:were\s+)?(?:unreadable|guarded|searching|shuttered|veiled)\b/i,
      // the whole family in one: any facial feature "doing something"
      /\b(?:h(?:er|is|their)|the)\s+(?:face|mouth|eyes|jaw|features|expression)\s+(?:did|does|do|doing)\s+(?:something|a thing)\b/i,
      /\b(?:did|does)\s+something\s+(?:small|complicated|private|quiet|brief|odd|strange)\b/i,
      /\b(?:h(?:er|is|their))\s+(?:face|expression)\s+(?:closed off|shuttered|went somewhere)\b/i,
    ],
  },
  {
    // "not mocking, just fitting the sentence into her mouth" — a correction
    // handed to the reader in place of an image, and one of my own habits that
    // went into the prompts and came straight back out in the prose.
    family: "negate and correct",
    patterns: [
      /,\s*not\s+\w+(?:ing|ed|ly)?\s*,\s*(?:just|only|merely|simply)\s+\w+/i,
      /\bnot\s+(?:because|that)\s+[^.,;]{4,40},\s*(?:just|but)\s+(?:because|that)\b/i,
      /\bnot\s+\w{3,14},\s+(?:exactly|quite)[.,]/i,
    ],
  },
  {
    family: "charged air",
    patterns: [
      /\bthe\s+(?:air|space|silence|steam|quiet|distance)\s+between\s+(?:them|you|us|the two of you)\b/i,
      /\b(?:curl\w*|hang\w*|sat|sits|settle\w*|rose|rises)\s+(?:up\s+)?between\s+the\s+two\s+of\s+(?:you|them)\b/i,
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
    family: "euphemism for the body",
    patterns: [
      /\b(?:h(?:er|is|their))\s+(?:core|heat|sex|centre|center|entrance|folds|bud|nub|mound|petals|flower|velvet|womanhood|manhood|maidenhood)\b/i,
      /\bh(?:er|is|their)\s+(?:length|member|shaft|arousal|need|desire)\s+(?:against|into|inside|pressed|throbb\w*|strain\w*)/i,
      /\b(?:velvet|silken|molten|honeyed)\s+(?:heat|walls|warmth|skin|core)\b/i,
      /\bthe\s+(?:apex|juncture)\s+of\s+h(?:er|is|their)\s+thighs\b/i,
    ],
  },
  {
    family: "weather instead of sensation",
    patterns: [
      /\bwaves?\s+of\s+(?:pleasure|sensation|heat|need|desire|want)\b/i,
      /\b(?:pleasure|sensation|heat|desire)\s+(?:crash\w*|wash\w*|flood\w*|surg\w*|rippl\w*|roll\w*)\s+(?:over|through)/i,
      /\b(?:jolt|shock|spark|current|bolt|shiver)s?\s+(?:of\s+\w+\s+)?(?:shot|ran|raced|shot through|through)\b/i,
      /\bsent\s+(?:shivers|sparks|heat|fire)\s+(?:through|down|racing)/i,
      /\bset\s+h(?:er|is|their)\s+(?:skin|blood|body|nerves)\s+(?:on fire|alight|ablaze)/i,
    ],
  },
  {
    family: "the dissolution",
    patterns: [
      /\b(?:came|come|coming)\s+undone\b/i,
      /\b(?:shatter\w*|unravel\w*|fell apart|falling apart|splinter\w*)\b.{0,24}\b(?:beneath|under|around|against)\s+(?:him|her|them|you)\b/i,
      /\bsaw\s+stars\b/i,
      /\bh(?:er|is|their)\s+world\s+(?:narrow\w*|shrank|reduced)\s+to\b/i,
      /\b(?:exploded|detonated)\s+(?:around|beneath|inside)\b/i,
    ],
  },
  {
    family: "the body as a separate agent",
    patterns: [
      /\bh(?:er|is|their)\s+body\s+(?:betray\w*|respond\w*|answer\w*|arch\w*\s+of its own|had other ideas)/i,
      /\bof\s+(?:its|their)\s+own\s+accord\b/i,
      /\b(?:could|couldn'?t)\s+(?:not\s+)?help\s+(?:h(?:er|im|them)self|but)\b/i,
      /\b(?:she|he|they)\s+found\s+h(?:er|im|them)self\b/i,
    ],
  },
  {
    family: "force as intensity",
    patterns: [
      /\b(?:pound\w*|slamm\w*|impal\w*|ramm\w*)\s+(?:into|onto|against)\s+(?:h(?:er|im|them)|you)\b/i,
      /\bburi(?:ed|es)\s+h(?:im|er|them)self\s+(?:in|inside)\b/i,
      /\bfill\w*\s+h(?:er|im|them)\s+(?:completely|entirely|utterly|to the hilt)\b/i,
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
export function ticCorrection(tics: Tic[], faults: { quote: string; why: string }[] = []): string {
  const lines = [
    ...tics.slice(0, 3).map((t) => `  "${t.phrase}" — ${t.family}`),
    ...faults.slice(0, 3).map((f) => `  "${f.quote}" — ${f.why}`),
  ];
  if (!lines.length) return "";
  return [
    `Here are sentences from the turn you just wrote that are not working:`,
    ...lines,
    `Don't write anything like those this turn. If you can't find a way to make a moment land without reaching for a face doing something unnamed, or a charged silence, or somebody saying a line that could go on a poster, then let the moment not land. An ordinary exchange written plainly is worth more than a charged one written the way everybody else writes it.`,
  ].join("\n");
}

/** Both prohibitions, for the calls where sex may actually reach the page. */
export const VOICE_CONTRACT = `${NO_TROPES}\n\n${NO_PURPLE}`;

/** For the small gauge in the journal: how clean was this run. */
export function ticRate(history: { narrator_prose?: string }[], window = 12): number {
  const recent = history.slice(-window).filter((h) => h.narrator_prose);
  if (!recent.length) return 0;
  const hit = recent.filter((h) => findTics(h.narrator_prose!, 1).length > 0).length;
  return hit / recent.length;
}
