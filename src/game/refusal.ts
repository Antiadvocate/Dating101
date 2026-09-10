/**
 * WHEN A MODEL WON'T WRITE IT.
 *
 * The recovery ladder inside complete() fires on errors — a 400, a timeout, a
 * dead provider. A model that declines to write an explicit scene does not
 * error. It returns HTTP 200 with a paragraph of apology, or worse, it returns
 * a scene with the sex taken out of it and nothing anywhere says so. Both
 * failures were invisible: the first arrived on the page as the narrator
 * suddenly addressing the player in the second person about content policy, and
 * the second just looked like a chapter that did not go anywhere.
 *
 * So the calls that can be refused now ask for a specific answer when the model
 * would rather not, and that answer is checked for. A model saying no on
 * purpose, in one word, is worth far more than a model saying no in a
 * paragraph, because one word can be routed and a paragraph has to be guessed
 * at.
 */

/** Appended to any prompt that could be declined. */
export const REFUSAL_CONTRACT = `IF YOU WILL NOT WRITE THIS: reply with the single word REFUSED and nothing else. No apology, no explanation, no alternative, no softened version. One word.

That is a real option and taking it is better than the alternatives. Do not write a version with the substance removed, do not fade out at the moment that matters, and do not replace what was asked for with something tamer and leave it looking like the scene simply went that way — a quiet substitution is the one outcome nobody can act on. The player has configured a second model for exactly this, and one word hands the work to it cleanly.`;

/** The sentinel, plus the shapes a refusal takes when the sentinel is ignored. */
const SHAPES: RegExp[] = [
  /^\s*\**\s*REFUSED\b/i,
  /\bI (?:can'?t|cannot|won'?t|will not|am not able to|am unable to)\s+(?:help|assist|write|create|generate|continue|produce|provide)\b/i,
  /\bI'?m (?:sorry|afraid|not able|unable)\b[^.]{0,60}\b(?:can'?t|cannot|won'?t|unable)\b/i,
  /\b(?:against|violates?|outside)\s+(?:my|our|the)\s+(?:guidelines|policies|policy|content policy|usage policies)\b/i,
  /\bI (?:don'?t|do not) (?:feel comfortable|think I should)\b/i,
  /\bas an AI\b/i,
];

/**
 * Did the model decline.
 *
 * Length is part of the test and it is doing real work. "I can't" inside a
 * thousand words of prose is a character speaking; the same phrase as most of a
 * two-line response is the model speaking. Anything past the cap is treated as
 * a genuine attempt whatever it contains, so a scene where somebody says they
 * cannot do this is never mistaken for a refusal.
 */
export function isRefusal(text: string, cap = 700): boolean {
  const t = (text ?? "").trim();
  if (!t) return false;
  if (/^\s*\**\s*REFUSED\s*\**\s*$/i.test(t)) return true;
  if (t.length > cap) return false;
  /* Dialogue is not a refusal. A character saying "I can't continue like this"
     is a scene, and a short scene that opens on one would otherwise be thrown
     away and re-bought from another model. Quoted spans come out before the
     test, which leaves only what the narrator said in its own voice. */
  const unquoted = t.replace(/["\u201c][^"\u201d]*["\u201d]/g, " ");
  return SHAPES.some((re) => re.test(unquoted));
}

/** What gets recorded so the console can say it happened. */
export interface RefusalNote {
  at: number;
  /** Which call — narrator, the scene between chapters, the ending. */
  where: string;
  model: string;
  /** Where it was routed, or empty if there was nowhere to route it. */
  routed_to: string;
  /** The first line of what came back, so a wrong detection is visible. */
  said: string;
}

export function noteOf(where: string, model: string, routed_to: string, said: string): RefusalNote {
  return {
    at: Date.now(), where, model, routed_to,
    said: (said ?? "").trim().split("\n")[0].slice(0, 160),
  };
}
