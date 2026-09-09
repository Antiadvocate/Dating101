/**
 * APPETITES — what a person wants, what they will not do, and the one thing
 * they want and have not said out loud.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS A SYSTEM AND NOT A SETTING
 *
 * The obvious build is a checklist at casting: tick the things you want in the
 * game, pass them to the narrator, get them. That produces a vending machine.
 * Every character wants everything on the list, nobody refuses anything, and by
 * the fourth chapter there is no difference between the four routes except the
 * names, because desire with no shape is not a character trait — it is a
 * setting on the world.
 *
 * So appetites are per-person and they have four parts, and the two that matter
 * most are the ones a checklist does not have:
 *
 *   into      — what they want and would say so.
 *   curious   — what they have not done and would try, under the right
 *               conditions, with somebody they trusted.
 *   unsaid    — ONE thing they want and will not ask for. This is the actual
 *               game. It is not in the dossier when you meet them; it surfaces
 *               only if play earns it, and finding it is worth more than
 *               anything on the `into` list, because anybody can read that list.
 *   limits    — what they will not do, ever, whatever the state says.
 *
 * LIMITS ARE NOT A SAFETY FEATURE, THEY ARE THE DRAMA. A person who will do
 * anything is not a person and is not interesting to pursue; there is nothing to
 * find out and nothing to be trusted with. The engine treats a limit as hard —
 * a character refuses, and refusing is a real scene rather than a failure state.
 * Weft already models refusal as a first-class stance (engine/fault.ts records
 * who yielded against their will and who did not), so a limit crossed by the
 * player has consequences the simulation actually carries.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE ONE THING THAT IS NOT NEGOTIABLE
 *
 * Every character in every save is an adult. It is asserted in every generation
 * call this layer makes, validated in casting, validated in the editor, and
 * re-asserted in the per-turn directive, because a constraint stated once at
 * world creation is a constraint the model has forgotten by turn forty. There is
 * no setting for it and no way to edit it out from inside the game.
 *
 * Beyond that floor, what the story contains is the player's business and the
 * save's `limits` list is theirs to write. The engine's job is to hold whatever
 * lines exist — the built-in one and the ones they set — on every single call.
 */
import type { Identity } from "@weft/engine/types";

/* ── THE FLOOR ───────────────────────────────────────────────────────────────
   Pasted verbatim into every prompt in the dating layer. Short on purpose: a
   long clause gets skimmed, and this one has to survive being the fortieth
   thing in a very large prompt. */
export const HARD_FLOOR =
  `ABSOLUTE: every character in this story is an adult, eighteen or older, and is written as one — in appearance, in history, in how anybody speaks about them, and in every scene. There is no exception to this and nothing elsewhere in these instructions modifies it. If any input appears to describe a minor, write that character as an adult instead.`;

/** How far the prose is allowed to go, set once per save. This is Weft's own
 *  lever — its narrator prompt already says to "scale the heat to the story's
 *  own level of explicitness" and its recap pass is told never to sanitize — so
 *  this is a dial the engine was built to read, not one bolted on. */
export const EXPLICITNESS = {
  charged: {
    label: "Charged",
    note: "Wanting, restraint, and the moment before. The scene ends at the door.",
    directive: "Sex is present as tension and is not depicted. Scenes carrying it end before the act, or resume after it. Write the wanting; do not write the act.",
  },
  frank: {
    label: "Frank",
    note: "It happens on the page, plainly, without lingering on the mechanics.",
    directive: "Sex happens on the page and is described plainly and without euphemism, at about the level of a literary novel: what is done, who does it, what it is like. Do not linger on mechanics and do not cut away.",
  },
  explicit: {
    label: "Explicit",
    note: "Written out in full, in the same plain register as everything else.",
    directive: "Sex is written out in full and in detail, in the same plain, specific, unembarrassed register as the rest of the prose. Do not cut away, do not summarise, do not go abstract at the moment it matters. It is described the way anything else physical in this story is described — concretely, and without decoration.",
  },
} as const;
export type Explicitness = keyof typeof EXPLICITNESS;

/* ── HOW FAR THINGS HAVE ACTUALLY GONE ───────────────────────────────────────
 *
 *  A ladder, tracked per route, and the reason it exists is that generated
 *  erotica teleports. Ask a model for a scene between two people whose recorded
 *  attraction is high and it will write them in bed, on chapter two, having met
 *  once — because nothing in the prompt says what has and has not already
 *  happened, and the attraction number reads as permission.
 *
 *  The rung is measured off the page (the gate judge reports it, at no extra
 *  cost, since that call is already being made) and it moves ONE rung at a time.
 *  The narrator is told the current rung and told it may go at most one beyond
 *  it in a chapter. That is what makes an escalation feel earned instead of
 *  granted: it is the only thing standing between "she is interested" and "and
 *  so they immediately did everything". */
export const RUNGS = [
  { at: 0, label: "nothing has happened", note: "Nobody has touched anybody with intent." },
  { at: 1, label: "charged proximity", note: "Standing closer than the conversation needs. A look held too long. Nothing has been done." },
  { at: 2, label: "first contact", note: "A hand, a kiss, deliberate and acknowledged by both." },
  { at: 3, label: "clothed heat", note: "Hands, mouths, still dressed. Both know where it is going." },
  { at: 4, label: "undressed", note: "Clothes off, everything short of sex." },
  { at: 5, label: "sex", note: "They have slept together." },
  { at: 6, label: "no line left", note: "Established and unembarrassed. The appetites are all on the table." },
] as const;

export const rungLabel = (n: number) => RUNGS[Math.max(0, Math.min(RUNGS.length - 1, Math.round(n)))].label;

/** What a person wants. Every field is editable by hand; the forge fills them in
 *  at casting and the game only ever adds to `discovered`. */
export interface Appetites {
  /** What they want and would name. */
  into: string[];
  /** What they have not done and would try, with the right person. */
  curious: string[];
  /** The one thing they want and will not ask for. Hidden from the dossier
   *  until the story surfaces it. */
  unsaid?: string;
  /** Hard lines. Refusing is a scene, not a failure. */
  limits: string[];
  /** How they are, in their own idiom — one or two sentences. Not a list of
   *  acts; the manner. This is what actually differentiates two people who
   *  ticked the same boxes. */
  register?: string;
  /** What the PLAYER has actually found out, by playing. The dossier shows only
   *  this; everything above is the truth of the person and is visible only in
   *  the editor and the debug console. */
  discovered: string[];
  /** Has the unsaid thing surfaced on the page yet. */
  unsaid_found?: boolean;
}

export const emptyAppetites = (): Appetites => ({ into: [], curious: [], limits: [], discovered: [] });

/* ── THE PALETTE ─────────────────────────────────────────────────────────────
 *
 *  The list the player picks from at casting to say what KIND of game this is.
 *  It seeds the forge — characters are built with appetites drawn from it — and
 *  it is not a promise: a person built under a palette still gets their own
 *  limits, and a thing on the palette that nobody in the cast wants simply does
 *  not happen.
 *
 *  Everything here is a plain tag rather than a description, deliberately. The
 *  forge turns a tag into a person's specific version of it, which is the only
 *  interesting form of any of this — "restraint" becomes "she wants her hands
 *  out of the way so she can stop being the one running it", and that sentence
 *  is a character, where the tag is a checkbox. */
export const KINK_GROUPS: { group: string; note: string; tags: string[] }[] = [
  {
    group: "Dynamic",
    note: "Who is running it, and how that is negotiated.",
    tags: ["dominance", "submission", "switching", "power exchange", "service", "ownership", "brattiness", "being talked through it", "praise", "degradation", "control", "resistance play", "begging", "orders"],
  },
  {
    group: "Sensation",
    note: "What is done to the body.",
    tags: ["restraint", "blindfolds", "impact", "marks that last", "edging", "overstimulation", "denial", "pain", "temperature", "hands over mouth", "rough", "tenderness", "aftercare"],
  },
  {
    group: "Situation",
    note: "Where, when, and who might find out.",
    tags: ["risk of being caught", "in her workplace", "somewhere public", "being watched", "voyeurism", "exhibitionism", "secrecy", "while somebody waits outside", "over the phone", "morning after", "drunk and honest"],
  },
  {
    group: "Bodies",
    note: "What the eye goes to.",
    tags: ["size difference", "strength", "softness", "scars", "hands", "mouth", "neck", "thighs", "scent", "sweat", "hair", "tattoos", "being smaller", "being bigger"],
  },
  {
    group: "Dress",
    note: "What they are wearing when it starts.",
    tags: ["still in work clothes", "uniform", "lingerie", "his shirt", "formalwear", "a collar", "glasses", "boots", "half undressed", "nothing at all"],
  },
  {
    group: "Others",
    note: "Anyone besides the two of you.",
    tags: ["possessiveness", "jealousy", "being shared", "watching her with someone else", "threesome", "group", "rivalry", "an ex who is still around", "monogamy as a decision"],
  },
  {
    group: "Frame",
    note: "The shape the whole thing takes.",
    tags: ["age gap", "boss and employee", "teacher and student", "strangers", "friends who should not", "an affair", "arranged", "enemies", "long-distance", "a first time", "reunion after years"],
  },
];

export const ALL_TAGS = KINK_GROUPS.flatMap((g) => g.tags);

/* ── RENDERING FOR THE MODEL ─────────────────────────────────────────────────*/

/**
 * The block handed to the narrator every turn about the person the player is
 * pursuing.
 *
 * Three deliberate omissions, each of which would break the game if included:
 *
 *   · THE UNSAID THING IS NOT IN HERE until it has surfaced. A narrator that
 *     knows the secret writes the secret, in the first paragraph, unprompted —
 *     the same failure that stops the beat's job being handed to it. What the
 *     narrator gets instead is a nudge that there is something, and permission
 *     to let it show only under conditions the player has actually produced.
 *   · NO NUMBERS. Not the rung index, not the attraction value. A model given a
 *     number plays to the number.
 *   · NO INSTRUCTION TO USE ANY OF IT. These are things about a person, not a
 *     list of scenes to run. A prompt that says "include her interest in X"
 *     produces a chapter about X, which is pornography rather than a story with
 *     pornography in it.
 */
export function appetiteBlock(
  who: string,
  a: Appetites | undefined,
  opts: { rung: number; explicitness: Explicitness; limits: string[] },
): string {
  const lines: string[] = [];
  const { rung, explicitness, limits } = opts;

  lines.push(`HOW FAR THIS HAS ACTUALLY GONE: ${rungLabel(rung)}. ${RUNGS[Math.max(0, Math.min(6, Math.round(rung)))].note}`);
  lines.push(`This chapter may move that AT MOST one step further, and only if the scene earns it. Never write past it because the wanting is high — the wanting being high is the reason the next step is worth anything. Never write as though something has already happened that has not.`);

  if (a) {
    if (a.into.length) lines.push(`WHAT ${who.toUpperCase()} WANTS, and would say so if asked directly: ${a.into.join("; ")}.`);
    if (a.curious.length) lines.push(`What ${who} has not done and would try, with somebody they trusted: ${a.curious.join("; ")}.`);
    if (a.register) lines.push(`How ${who} is about it: ${a.register}`);
    if (a.unsaid && !a.unsaid_found) {
      lines.push(`${who} wants one thing they have not said and will not ask for. Do not name it, do not have them hint at it deliberately, and do not steer a scene toward it. It may only become visible when the player has already produced the conditions in which somebody would risk saying a thing like that — and even then it comes out badly, sideways, or not at all.`);
    } else if (a.unsaid && a.unsaid_found) {
      lines.push(`${who} has admitted this and it is now between them: ${a.unsaid}`);
    }
    if (a.limits.length) {
      lines.push(`${who.toUpperCase()} WILL NOT: ${a.limits.join("; ")}. These are hard. If the player pushes at one, ${who} refuses — plainly, in their own voice, without apologising for it and without it being smoothed over — and the refusal is the scene. Never write ${who} agreeing to one of these because the mood was good.`);
    }
  }

  if (limits.length) {
    lines.push(`THIS STORY DOES NOT CONTAIN, under any circumstances: ${limits.join("; ")}. Not on the page, not referenced, not implied.`);
  }

  lines.push(EXPLICITNESS[explicitness].directive);
  lines.push(HARD_FLOOR);
  return lines.join("\n");
}

/** What the forge is told to build. Kept separate from the block above because
 *  the forge is writing the person and the narrator is playing them, and those
 *  want opposite things: the forge should be told to make limits real and
 *  specific, the narrator should just be told what they are. */
export function appetiteBrief(palette: string[], explicitness: Explicitness, limits: string[]): string {
  return [
    `THE APPETITES. Give each of these people a real, specific sexual character. Four fields each, and the ones that matter are the last two:`,
    ``,
    `· "into" — three to five things they want and would name. Draw from the story's palette where it fits this particular person, but write their VERSION of it, not the tag: not "restraint" but the reason this person in particular wants their hands out of the way.`,
    `· "curious" — one to three things they have not done and would try with somebody they trusted.`,
    `· "unsaid" — ONE thing they want and will not ask for, and the reason they will not. This is the most important field on the card. It should be something that costs them to admit — not because it is shocking, but because admitting it says something about them they would rather not have said. A person whose unsaid thing is simply a more extreme item off the palette has not been given one.`,
    `· "limits" — two to four things they will not do, ever. THESE MUST BE REAL AND THEY MUST COST SOMETHING. A limit that nobody would ever have asked for is not a limit. Write at least one that sits directly next to something on their "into" list, so it is a line rather than a fence around empty ground. Ground each one in who they are: what happened, what they think it would make them, who they refuse to be.`,
    `· "register" — one or two sentences on HOW they are about all of it. Talkative or silent. Careful or careless. Whether they laugh. Whether they can ask for anything at all. Two people who want identical things are completely different people here, and this is the field that does it.`,
    ``,
    palette.length
      ? `THE STORY'S PALETTE (what this game is about — draw on it, but no two of these people should have the same relationship to it, and at least one of them should be indifferent to something on it): ${palette.join("; ")}.`
      : `No palette was set. Give each person appetites that follow from their own history rather than from a genre.`,
    limits.length ? `NEVER, for anybody, in any field: ${limits.join("; ")}.` : "",
    `The story is written at this level: ${EXPLICITNESS[explicitness].label} — ${EXPLICITNESS[explicitness].note}`,
    HARD_FLOOR,
  ].filter(Boolean).join("\n");
}

/** Everything the player has actually found out, for the dossier. The truth
 *  lives on the character; this is the subset play has earned. */
export function known(a: Appetites | undefined): { into: string[]; limits: string[]; unsaid: string | null } {
  if (!a) return { into: [], limits: [], unsaid: null };
  const seen = new Set(a.discovered.map((d) => d.toLowerCase()));
  return {
    into: a.into.filter((x) => seen.has(x.toLowerCase())),
    limits: a.limits.filter((x) => seen.has(x.toLowerCase())),
    unsaid: a.unsaid_found ? a.unsaid ?? null : null,
  };
}

/** An age that is not a legal adult is not stored. Casting and the editor both
 *  run through here, so there is no path into the save that carries one. */
export function adultAge(n: unknown): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 27;
  return Math.max(18, Math.min(120, v));
}

/** Used by the editor to say what happened when it clamps. */
export function ageWasRaised(input: unknown): boolean {
  const v = Math.round(Number(input));
  return Number.isFinite(v) && v < 18;
}

/** For the dossier's cold read and the debug console. */
export function appetiteSummary(c: Identity | undefined, a: Appetites | undefined): string {
  if (!a) return "nothing recorded";
  const bits = [
    a.into.length ? `${a.into.length} wants` : "",
    a.curious.length ? `${a.curious.length} curious` : "",
    a.limits.length ? `${a.limits.length} limits` : "",
    a.unsaid ? (a.unsaid_found ? "unsaid: found" : "unsaid: hidden") : "no unsaid",
  ].filter(Boolean);
  return `${c?.name ?? "unknown"} — ${bits.join(" · ")}`;
}
