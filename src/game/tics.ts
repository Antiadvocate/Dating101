/**
 * THE VOICE RULES.
 *
 * This file used to contain sixty-six regular expressions across sixteen
 * families, and it was deleted after being run against a real turn of prose
 * containing six obvious failures, where it matched none of them.
 *
 * That result is not a tuning problem. A pattern can only ever match a wording
 * somebody thought of in advance, and a language model has an unbounded number
 * of ways to make the same move. It wrote "her mouth does something small at
 * the corner" where the pattern was looking for "something unreadable crossed
 * her face", and it wrote "that's a choice you make in front of a witness",
 * which is a portable general sentence containing none of the vocabulary that a
 * maxim pattern looks for. Neither of those is evasion. The model was not
 * trying to get around anything; there is simply no finite list of strings that
 * covers a semantic category.
 *
 * The worse cost was the reporting. The studio printed a percentage derived
 * from those patterns, so a run full of exactly the writing this exists to stop
 * displayed as clean, which is worse than showing nothing at all.
 *
 * So there is no matching here now. What is left is the prose handed to the
 * models — the rules themselves — and a formatter for what the reader finds.
 * The reader lives in game/gate.ts, sees only the prose just written, and
 * answers the semantic question that a pattern cannot.
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

export interface VoiceFault {
  /** The offending sentence, verbatim, so it can be quoted back. */
  quote: string;
  /** A few words on which failure it is. */
  why: string;
}

/**
 * What gets quoted back at the narrator on the following turn.
 *
 * Weft uses this same mechanism for maxims, echoes and stated interiors, and it
 * is the only correction in the engine that reliably changes what the model
 * does next. A rule sitting in the system prompt gets read as reference
 * material; a sentence the model wrote two seconds ago gets read as a mistake.
 */
export function voiceCorrection(faults: VoiceFault[]): string {
  if (!faults.length) return "";
  return [
    `Here are sentences from the turn you just wrote that aren't working:`,
    ...faults.slice(0, 3).map((f) => `  "${f.quote}" — ${f.why}`),
    `Don't write anything like those this turn. If you can't make a moment land without a face doing something you decline to name, or a charged silence, or somebody saying a line that would fit on a poster, then let the moment not land. An ordinary exchange written plainly is worth more than a charged one written the way everyone else writes it.`,
  ].join("\n");
}

/**
 * Turn whatever the model returned into findings we are willing to act on.
 *
 * Pure, and exported, because this is the fragile half. A model asked to quote
 * a sentence will sometimes paraphrase it, trim it, fix its punctuation, or
 * invent one outright — and a fabricated quote handed back to the narrator as
 * "you wrote this" is worse than finding nothing, since it corrects a habit the
 * model does not have and leaves the one it does. So a finding survives only if
 * a real span of the prose is actually in it.
 */
export function parseFaults(raw: unknown, prose: string): VoiceFault[] {
  const j = raw as { faults?: { quote?: unknown; why?: unknown }[] } | null;
  const hay = prose.replace(/\s+/g, " ").toLowerCase();
  return (j?.faults ?? [])
    .map((f) => ({ quote: String(f?.quote ?? "").trim(), why: String(f?.why ?? "").trim() }))
    .filter((f) => {
      if (f.quote.length < 12) return false;
      const needle = f.quote.replace(/\s+/g, " ").toLowerCase();
      // Match on a solid opening span rather than the whole sentence, so a
      // finding is not thrown away over a changed dash or a dropped comma at
      // the end.
      return hay.includes(needle.slice(0, 28));
    })
    .slice(0, 3);
}
