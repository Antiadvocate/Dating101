/**
 * THE READ — the dating game's HUD, and it does not contain a number.
 *
 * Every dating sim ships an affection meter and almost every good visual novel
 * hides it. The reason is not coyness. A meter turns the person into a lock and
 * the conversation into a search for the key: you stop listening to what she
 * said and start watching whether the bar moved. Katawa Shoujo and Doki Doki
 * both hide their relationship values, and both are read as being about people.
 *
 * But a game that shows nothing is worse, because the player then genuinely
 * cannot tell a scene that landed from a scene that did nothing, and the whole
 * middle of a route becomes guesswork.
 *
 * So: no numbers, no bar. What you get is a SENTENCE — an observation of her
 * behaviour toward you, right now, in the same register as the prose. The whole
 * thing is computed from the engine's live edge (warmth, wanting, trust, and how
 * cleanly the wanting can be expressed), costs nothing, and can be checked
 * against the page: if the read says she keeps her answers to the length of the
 * question, and the prose has her talking freely, one of them is wrong and the
 * player can see it.
 *
 * The numbers still exist for anyone who wants them, behind a deliberate flip in
 * the dossier. Hidden by default, never gone.
 *
 * On the writing: no tropes, no aphorisms, nothing about hearts or breath, and
 * nothing that states an interior — the read describes what a person could
 * actually observe from across a table, because that is the only thing the
 * player has access to. "She has stopped checking her phone" is a read.
 * "She feels safe with you" is a claim nobody in the room could make.
 */
import { heatOf, type Heat } from "./arc";
import type { AnySave } from "./types";

/** Stable per (character, turn) so the read does not flicker while you type,
 *  and changes when the turn does. */
function pick<T>(bank: T[], seed: string): T {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return bank[Math.abs(h) % bank.length];
}

type Band<T extends string> = { key: T; at: number; lines: string[] };

/** Bands are declared high-to-low and matched on the first threshold the value
 *  clears, so adding one in the middle needs no other edit. */
function band<T extends string>(bands: Band<T>[], v: number): Band<T> {
  return bands.find((b) => v >= b.at) ?? bands[bands.length - 1];
}

const WARMTH: Band<string>[] = [
  { key: "held", at: 72, lines: [
    "She talks to you like there is no version of this where you are not around.",
    "There is no distance left in how she says your name.",
    "She has stopped explaining herself to you, which is its own kind of answer.",
  ]},
  { key: "close", at: 45, lines: [
    "She talks to you the way people talk to someone they already know.",
    "She tells you the boring parts, which she would not bother doing for a stranger.",
    "She has started finishing thoughts she began an hour ago, as though you were there for the first half.",
  ]},
  { key: "warm", at: 16, lines: [
    "She stays in the conversation past the point where she could leave it.",
    "She asks you a question back, and waits for the whole answer.",
    "She is easier with you than she was, and does not seem to have noticed.",
  ]},
  { key: "civil", at: -8, lines: [
    "She is civil. Nothing beyond that is on offer yet.",
    "She answers what you ask and does not add to it.",
    "You are being handled politely, the way anyone would be.",
  ]},
  { key: "cool", at: -34, lines: [
    "She keeps her answers to about the length of the question.",
    "She has been looking past you at whatever is behind you.",
    "Something you did is still sitting between you and she is not going to raise it.",
  ]},
  { key: "hostile", at: -1000, lines: [
    "She answers you and then looks at the door.",
    "She is here because leaving would be a scene, and she is weighing that.",
    "Whatever this is now, it is not going to be repaired in one evening.",
  ]},
];

const WANTING: Band<string>[] = [
  { key: "consuming", at: 68, lines: [
    "She is not pretending to be interested in anything else in the room.",
    "Every time you move she tracks it and does not hide that she is doing it.",
  ]},
  { key: "pull", at: 40, lines: [
    "She has been finding reasons to stand nearer than the conversation requires.",
    "She touched your arm to make a point that did not need it.",
    "She looks at your mouth while you are talking and then away.",
  ]},
  { key: "noticed", at: 14, lines: [
    "She holds your eye a beat past where she needs to.",
    "She checked what you were wearing when you came in.",
    "There is something switched on in how she is sitting that was not on ten minutes ago.",
  ]},
  { key: "flat", at: -14, lines: [
    "She has not thought about you that way, and nothing tonight has changed it.",
    "Whatever she is enjoying here, it is the talking.",
  ]},
  { key: "averse", at: -1000, lines: [
    "She moves her chair back when you lean in, without appearing to decide to.",
    "Whatever else is going on, she does not want to be touched by you.",
  ]},
];

const TRUST: Band<string>[] = [
  { key: "open", at: 55, lines: [
    "She tells you things before working out whether she should.",
    "She has stopped choosing her words in front of you.",
  ]},
  { key: "willing", at: 22, lines: [
    "She let one true thing through and watched what you did with it.",
    "She is testing small pieces of honesty on you and they keep coming back intact.",
  ]},
  { key: "guarded", at: -12, lines: [
    "She is giving you the version of the story that is safe to give anyone.",
    "She has not lied to you. She has also not told you much.",
  ]},
  { key: "wary", at: -1000, lines: [
    "She checks what you do with anything she says before she says the next thing.",
    "She does not believe you, and is being pleasant about it.",
  ]},
];

/** How cleanly the wanting can come out — Weft's `desire_admissibility`. Low is
 *  the grasping, sideways texture; high is a person who can want something and
 *  let it stand. This is the channel that separates two identical attraction
 *  numbers into two completely different evenings, so it earns a line. */
const TEXTURE: Band<string>[] = [
  { key: "clean", at: 0.68, lines: [
    "Whatever she wants from you, she can say out loud, which makes it easy to be around.",
  ]},
  { key: "mixed", at: 0.38, lines: [
    "It comes out sideways with her — a joke at the wrong moment, a question she does not want answered.",
  ]},
  { key: "gripped", at: -1, lines: [
    "It is not coming out straight. It comes out as sharpness, and then as an apology for the sharpness.",
  ]},
];

export interface Reading {
  /** The headline observation — warmth, because that is the channel a player
   *  can act on most directly. */
  line: string;
  /** Three or four short readings that fill in the rest, each a sentence. */
  facets: { label: string; line: string }[];
  /** Present when the route has a structural problem the player cannot fix by
   *  playing better, and deserves to be told about. */
  caution: string | null;
  heat: Heat;
}

export function readOf(s: AnySave, char_id: string): Reading {
  const h = heatOf(s, char_id);
  const seed = `${char_id}:${s.world.current_turn}`;

  const w = band(WARMTH, h.warmth);
  const a = band(WANTING, h.attraction);
  const t = band(TRUST, h.trust);
  const x = band(TEXTURE, h.admissibility);

  const facets = [
    { label: "Wanting", line: pick(a.lines, seed + ":a") },
    { label: "Trust", line: pick(t.lines, seed + ":t") },
    { label: "How it comes out", line: pick(x.lines, seed + ":x") },
  ];

  /* THE PLATEAU. Weft caps how far warmth alone can lift attraction, so a flat
     conditioned first read never becomes passion however well the route is
     played — it settles at fondness, which is a real relationship and not the
     one the player thinks they are working toward. Nothing about the prose will
     ever say this, and a player who is not told will keep trying harder at a
     door that does not open. */
  /* The old threshold on this required warmth above 30 before it would say
     anything, and the save that prompted it sat at 25.7 — so the one route in
     the game that could not be won by playing it well reported nothing at all.
     A low ceiling is worth saying whatever the warmth is doing, because it is
     the only state in here that no amount of good play will move. */
  let caution: string | null = null;
  if (h.base < 15) {
    caution = "Her first read of you was close to flat, and that sets a ceiling on how far wanting can go — being good to her lifts liking, not this. It can still become something; it is not going to become that. The console can raise the ceiling if this is not the game you wanted.";
  } else if (h.attraction >= 45 && h.trust <= 8) {
    caution = "She wants you and tells you nothing. That is a shape this can end in, and it is not the good one.";
  } else if (h.warmth <= -30 && h.attraction >= 35) {
    caution = "She does not like you much and wants you anyway. Nobody has ever enjoyed the back half of that.";
  }

  return { line: pick(w.lines, seed + ":w"), facets, caution, heat: h };
}

/** One line, for the strip above the composer where there is no room for more.
 *  Alternates channels by turn so the same sentence is not standing there for
 *  the whole scene. */
export function shortRead(s: AnySave, char_id: string): string {
  const r = readOf(s, char_id);
  const rota = [r.line, ...r.facets.map((f) => f.line)];
  return rota[s.world.current_turn % rota.length];
}

/** The numbers, for the dossier's cold-read panel. Only place in the app where
 *  a value is printed as a value. */
export function coldRead(s: AnySave, char_id: string): { label: string; value: number; of: string }[] {
  const h = heatOf(s, char_id);
  return [
    { label: "Warmth", value: h.warmth, of: "−100…100" },
    { label: "Wanting", value: h.attraction, of: "−100…100" },
    { label: "Trust", value: h.trust, of: "−100…100" },
    { label: "First read (ceiling on wanting)", value: Math.round(h.base), of: "−100…100" },
    { label: "Expressible", value: Math.round(h.admissibility * 100), of: "0…100" },
    { label: "Composite", value: h.value, of: "0…100" },
  ];
}
